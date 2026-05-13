import { io, Socket } from 'socket.io-client';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { gameAudio } from './utils/audio';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface GameState {
  status: 'waiting' | 'flying' | 'crashed';
  mult: number;
  waitSec: number;
  crashPoint: number;
  roundNum: number;
}
export interface HistoryItem { m: number; round: number; }
export interface PlayerBet { id: string; name: string; amount: number; cashedOut?: boolean; mult?: number; }
export interface TxItem { label: string; amount: number; plus: boolean; time: string; }
export interface AdminUser { id: string; name: string; bal: number; isAdmin: boolean; }
export interface User { name: string; email: string; isAdmin: boolean; pass?: string; }

// ─── Backend URL Configuration ───────────────────────────────────────────────
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:4000'
    : window.location.origin);

// ─── Socket Singleton ────────────────────────────────────────────────────────
const socket: Socket = io(BACKEND_URL, { autoConnect: false });


// ─── Context ─────────────────────────────────────────────────────────────────
interface AppCtx {
  socket: Socket;
  user: User | null; setUser: (u: User | null) => void;
  bal: number; setBal: (b: number) => void;
  gameState: GameState; setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  history: HistoryItem[]; setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  liveBets: PlayerBet[]; setLiveBets: React.Dispatch<React.SetStateAction<PlayerBet[]>>;
  countdown: number;
  bet1Placed: boolean; setBet1Placed: (b: boolean) => void;
  bet2Placed: boolean; setBet2Placed: (b: boolean) => void;
  bet1CashedOut: boolean; setBet1CashedOut: (b: boolean) => void;
  bet2CashedOut: boolean; setBet2CashedOut: (b: boolean) => void;
  currentBet1: number; setCurrentBet1: (b: number) => void;
  currentBet2: number; setCurrentBet2: (b: number) => void;
  adminUsers: AdminUser[];
  adminRounds: number[];
  txList: TxItem[]; addTx: (t: TxItem) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isMuted: boolean; setIsMuted: (m: boolean) => void;
}

const Ctx = createContext<AppCtx>(null!);
export const useApp = () => useContext(Ctx);

// ─── Toast System ────────────────────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; type: 'success' | 'error' | 'info'; }

let toastId = 0;
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const { socket } = useApp();

  const add = useCallback((msg: string, type: ToastMsg['type'] = 'success') => {
    const id = ++toastId;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    socket.on('toast', ({ msg, type }: { msg: string; type: ToastMsg['type'] }) => add(msg, type));
    return () => { socket.off('toast'); };
  }, [socket, add]);

  // expose globally via context – done in AppProvider
  (window as any).__showToast = add;

  return (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
    </div>
  );
}

// ─── App Provider ────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aviator_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (typeof window !== 'undefined') {
      if (u) {
        localStorage.setItem('aviator_user', JSON.stringify(u));
      } else {
        localStorage.removeItem('aviator_user');
      }
    }
  }, []);

  const [bal, setBal] = useState(0);
  const [gameState, setGameState] = useState<GameState>({ status: 'waiting', mult: 1.0, waitSec: 5, crashPoint: 2, roundNum: 1 });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [liveBets, setLiveBets] = useState<PlayerBet[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [bet1Placed, setBet1Placed] = useState(false);
  const [bet2Placed, setBet2Placed] = useState(false);
  const [bet1CashedOut, setBet1CashedOut] = useState(false);
  const [bet2CashedOut, setBet2CashedOut] = useState(false);
  const [currentBet1, setCurrentBet1] = useState(0);
  const [currentBet2, setCurrentBet2] = useState(0);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminRounds, setAdminRounds] = useState<number[]>([]);
  const [txList, setTxList] = useState<TxItem[]>([{ label: 'Welcome Bonus', amount: 1000, plus: true, time: 'Today' }]);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    gameAudio.setMuted(isMuted);
  }, [isMuted]);

  // Use refs to make the latest values available immediately inside socket listener callbacks
  const bet1PlacedRef = useRef(false);
  const bet2PlacedRef = useRef(false);
  const bet1CashedOutRef = useRef(false);
  const bet2CashedOutRef = useRef(false);
  const currentBet1Ref = useRef(0);
  const currentBet2Ref = useRef(0);

  useEffect(() => { bet1PlacedRef.current = bet1Placed; }, [bet1Placed]);
  useEffect(() => { bet2PlacedRef.current = bet2Placed; }, [bet2Placed]);
  useEffect(() => { bet1CashedOutRef.current = bet1CashedOut; }, [bet1CashedOut]);
  useEffect(() => { bet2CashedOutRef.current = bet2CashedOut; }, [bet2CashedOut]);
  useEffect(() => { currentBet1Ref.current = currentBet1; }, [currentBet1]);
  useEffect(() => { currentBet2Ref.current = currentBet2; }, [currentBet2]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    (window as any).__showToast?.(msg, type);
  }, []);

  const addTx = useCallback((t: TxItem) => setTxList(p => [t, ...p.slice(0, 49)]), []);

  useEffect(() => {
    socket.connect();

    // Auto-login on mount / refresh if user credentials exist in localStorage
    if (user && user.email && user.pass) {
      socket.emit('login', { action: 'login', email: user.email, pass: user.pass });
    }

    socket.on('state', (s: GameState) => {
      setGameState(s);
      if (s.status === 'waiting') {
        setBet1Placed(false); setBet1CashedOut(false); setCurrentBet1(0);
        setBet2Placed(false); setBet2CashedOut(false); setCurrentBet2(0);
        setLiveBets([]);
        gameAudio.stopEngine();
        gameAudio.stopMusic();
      } else if (s.status === 'flying') {
        gameAudio.startEngine();
        gameAudio.startMusic();
      }
    });
    socket.on('tick', ({ mult }: { mult: number }) => {
      setGameState(p => ({ ...p, mult }));
      gameAudio.updateEnginePitch(mult);
    });
    socket.on('crashed', ({ mult, history: h }: { mult: number; history: HistoryItem[] }) => {
      setGameState(p => ({ ...p, status: 'crashed', mult }));
      setHistory(h);
      gameAudio.stopMusic();
      gameAudio.stopEngine();
      gameAudio.playCrash();
    });
    socket.on('history', (h: HistoryItem[]) => setHistory(h));
    socket.on('countdown', (n: number) => setCountdown(n));
    socket.on('balUpdate', (b: number) => setBal(b));

    socket.on('betConfirmed', ({ amount, panelId }) => {
      if (panelId === 1) {
        setBet1Placed(true);
        setCurrentBet1(amount);
      } else {
        setBet2Placed(true);
        setCurrentBet2(amount);
      }
      gameAudio.playBetClick();
      showToast(`Bet of $${amount} Placed!`, 'success');
    });

    socket.on('cashOutConfirmed', ({ mult, win, panelId }) => {
      if (panelId === 1) {
        setBet1CashedOut(true);
      } else {
        setBet2CashedOut(true);
      }
      gameAudio.playCashout();
      addTx({ label: `Cashout at ${mult.toFixed(2)}x`, amount: win, plus: true, time: '' });
      showToast(`Cashed out at ${mult.toFixed(2)}x! Won $${win}`, 'success');
    });

    socket.on('betLost', ({ mult, panelId }) => {
      if (panelId === 1) {
        setBet1Placed(false);
      } else {
        setBet2Placed(false);
      }
      const amt = panelId === 1 ? currentBet1Ref.current : currentBet2Ref.current;
      addTx({ label: `Lost Bet (${mult.toFixed(2)}x)`, amount: amt, plus: false, time: '' });
      showToast(`Crash at ${mult.toFixed(2)}x! Lost $${amt}`, 'error');
    });

    socket.on('txAdded', (tx: TxItem) => addTx({ ...tx, time: new Date().toLocaleTimeString() }));
    socket.on('playerBet', (p: PlayerBet) => setLiveBets(prev => [p, ...prev]));
    socket.on('playerCashOut', ({ id, mult }: { id: string; mult: number }) =>
      setLiveBets(prev => prev.map(p => p.id === id ? { ...p, cashedOut: true, mult } : p))
    );
    socket.on('adminUsersUpdate', (list: AdminUser[]) => setAdminUsers(list));
    socket.on('adminRoundsUpdate', (rounds: number[]) => setAdminRounds(rounds));
    socket.on('kicked', () => { showToast('You have been kicked by admin', 'error'); setUser(null); });

    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [showToast, addTx]);

  const ctx: AppCtx = {
    socket, user, setUser, bal, setBal, gameState, setGameState,
    history, setHistory, liveBets, setLiveBets, countdown,
    bet1Placed, setBet1Placed, bet2Placed, setBet2Placed,
    bet1CashedOut, setBet1CashedOut, bet2CashedOut, setBet2CashedOut,
    currentBet1, setCurrentBet1, currentBet2, setCurrentBet2,
    adminUsers, adminRounds, txList, addTx, showToast,
    isMuted, setIsMuted,
  };

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

export { socket };
