import React, { useEffect, useRef, useState } from 'react';
import { useApp, BACKEND_URL } from '../store';
import type { HistoryItem, PlayerBet } from '../store';

// ─── COLOR THEMED MULTIPLIER HISTORY PILLS ──────────────────────────────────
function HistoryBar({ history }: { history: HistoryItem[] }) {
  const getClass = (m: number) => {
    if (m < 2.0) return 'low';
    if (m < 10.0) return 'mid';
    return 'high';
  };

  return (
    <div className="history-bar animate-fade-in">
      <div className="history-pills-scroll">
        {history.slice(0, 35).map((h, i) => (
          <span key={i} className={`hist-pill ${getClass(h.m)}`}>
            {h.m.toFixed(2)}x
          </span>
        ))}
        {history.length === 0 && (
          <span className="history-empty">
            No rounds completed yet...
          </span>
        )}
      </div>
      <button className="history-expand-btn" title="Round History">
        ▼
      </button>
    </div>
  );
}

// ─── GRAPHICAL GAME CANVAS ───────────────────────────────────────────────────
function GameCanvas() {
  const { gameState } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const planeImgRef = useRef<HTMLImageElement | null>(null);
  const dispMultRef = useRef(1.0);

  // Load custom premium plane graphic
  useEffect(() => {
    const img = new Image();
    img.src = '/plane.png';
    img.onload = () => {
      planeImgRef.current = img;
    };
  }, []);

  // Monitor state changes to reset curve points
  useEffect(() => {
    if (gameState.status === 'flying') {
      pointsRef.current = [];
      dispMultRef.current = 1.0;
    }
  }, [gameState.status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W === 0 || H === 0) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      canvas.width = W;
      canvas.height = H;

      // Draw Grid System
      ctx.fillStyle = '#0a0a0b';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const status = gameState.status;
      
      // Interpolate multiplier scale for high-fps buttery-smooth motion
      let mult = dispMultRef.current;
      if (status === 'flying') {
        mult += (gameState.mult - mult) * 0.12;
        dispMultRef.current = mult;
      } else {
        mult = gameState.mult;
        dispMultRef.current = mult;
      }

      if (status === 'flying' || status === 'crashed') {
        // Beautiful curve coordinates starting at bottom-left sweeping to top-right corner
        const startX = W * 0.05;
        const startY = H * 0.94;
        
        const progress = (mult - 1) / (mult + 1.8);
        const endX = startX + (W * 0.85) * progress;
        const endY = startY - (H * 0.85) * Math.pow(progress, 1.5);

        if (status === 'flying') {
          pointsRef.current.push({ x: endX, y: endY });
        }

        // Maintain continuous curve coordinates
        if (pointsRef.current.length === 0) {
          pointsRef.current.push({ x: startX, y: startY });
          pointsRef.current.push({ x: endX, y: endY });
        }

        const pts = pointsRef.current;

        // Draw fill gradient beneath the flight curve
        if (pts.length > 1) {
          // Gradient fill
          const grad = ctx.createLinearGradient(0, startY, 0, endY);
          grad.addColorStop(0, 'rgba(225, 29, 72, 0.22)'); // Translucent Aviator Red
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.beginPath();
          ctx.moveTo(pts[0].x, startY);
          pts.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.lineTo(pts[pts.length - 1].x, startY);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          // Core Flight Trajectory line
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          pts.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.strokeStyle = status === 'crashed' ? 'rgba(225, 29, 72, 0.2)' : '#e11d48';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#e11d48';
          ctx.shadowBlur = status === 'crashed' ? 0 : 12;
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset
        }

        // Draw Propeller Plane
        if (status === 'flying') {
          const px = endX;
          // Add vibrational engine wobble to emulate aircraft high-velocity flying
          const py = endY + Math.sin(Date.now() / 80) * 2.5;
          ctx.save();
          ctx.translate(px, py);
          
          // Rotate plane to match flight curve angle
          const angle = pointsRef.current.length > 1 
            ? Math.atan2(pointsRef.current[pointsRef.current.length - 1].y - pointsRef.current[pointsRef.current.length - 2].y, pointsRef.current[pointsRef.current.length - 1].x - pointsRef.current[pointsRef.current.length - 2].x) 
            : -0.25;
          ctx.rotate(angle);

          const planeW = 54;
          const planeH = 30;

          if (planeImgRef.current) {
            ctx.drawImage(planeImgRef.current, -planeW * 0.7, -planeH / 2, planeW, planeH);
          } else {
            // High-fidelity Vector Fallback Plane Drawing
            ctx.fillStyle = '#e11d48';
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-12, -8);
            ctx.lineTo(-8, 0);
            ctx.lineTo(-12, 8);
            ctx.closePath();
            ctx.fill();
            
            // Wings
            ctx.fillStyle = '#be123c';
            ctx.beginPath();
            ctx.ellipse(-2, 0, 4, 18, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // Thrust fire particle glow
          const glowRad = 4 + Math.sin(Date.now() / 40) * 2;
          ctx.fillStyle = 'rgba(232, 142, 0, 0.85)'; // Yellow fire
          ctx.beginPath();
          ctx.arc(-planeW * 0.7, 0, glowRad, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  return <canvas ref={canvasRef} className="full-canvas" />;
}

// ─── LIVE DYNAMIC MULTIPLIER DISPLAY ─────────────────────────────────────────
function MultOverlay() {
  const { gameState, countdown } = useApp();
  const { status, mult } = gameState;
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current && status === 'waiting') {
      const progressVal = (countdown / 5) * 100;
      barRef.current.style.transform = `scaleX(${progressVal / 100})`;
    }
  }, [countdown, status]);

  if (status === 'waiting') {
    return (
      <div className="waiting-overlay animate-fade-in">
        <div className="propeller-loader">
          <div className="propeller-blades"></div>
        </div>
        <div className="waiting-title">Waiting for next round</div>
        <div className="waiting-countdown-num">{countdown.toFixed(1)}s</div>
        <div className="loading-bar-container">
          <div className="loading-bar-fill" ref={barRef}></div>
        </div>
      </div>
    );
  }

  if (status === 'crashed') {
    return (
      <div className="crashed-overlay animate-fade-in">
        <div className="crashed-title">Flew Away!</div>
        <div className="crashed-mult">{mult.toFixed(2)}x</div>
      </div>
    );
  }

  return (
    <div className="mult-overlay">
      <div className="mult-value mult-val-white">{mult.toFixed(2)}x</div>
    </div>
  );
}

// ─── BETTING CONTROLS PANEL ──────────────────────────────────────────────────
function BetBox({ panelId }: { panelId: 1 | 2 }) {
  const { 
    socket, gameState, showToast, user, bal,
    bet1Placed, bet2Placed, 
    bet1CashedOut, bet2CashedOut, 
    currentBet1, currentBet2 
  } = useApp();
  const { status, mult } = gameState;

  const [amount, setAmount] = useState(100);
  const [autoCashout, setAutoCashout] = useState('');
  const [isAutoBet, setIsAutoBet] = useState(false);
  const [isAutoCashout, setIsAutoCashout] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  
  // Retrieve panel-specific states
  const betPlaced = panelId === 1 ? useApp().bet1Placed : useApp().bet2Placed;
  const cashedOut = panelId === 1 ? useApp().bet1CashedOut : useApp().bet2CashedOut;
  const currentBet = panelId === 1 ? useApp().currentBet1 : useApp().currentBet2;

  // Client-Authoritative Auto Cashout trigger
  useEffect(() => {
    if (status === 'flying' && betPlaced && !cashedOut && isAutoCashout && autoCashout) {
      const targetMult = parseFloat(autoCashout);
      if (targetMult && mult >= targetMult) {
        socket.emit('cashOut', { panelId });
      }
    }
  }, [status, mult, betPlaced, cashedOut, isAutoCashout, autoCashout, panelId, socket]);

  // Auto Bet Trigger when round starts waiting
  useEffect(() => {
    if (status === 'waiting' && isAutoBet && !betPlaced) {
      if (bal < 100) return; // Silent skip for auto bet if low bal
      // Place bet automatically with small timeout
      const t = setTimeout(() => {
        socket.emit('placeBet', { amount, panelId });
      }, 500);
      return () => clearTimeout(t);
    }
  }, [status, isAutoBet, betPlaced, amount, panelId, socket, user]);

  const placeBet = () => {
    if (bal < 100) return showToast('Insufficient balance (Min ₹100 required)', 'error');
    if (amount < 1) return showToast('Enter a valid amount', 'error');
    socket.emit('placeBet', { amount, panelId });
  };

  const cancelBet = () => {
    // Sockets allow cancels during waiting.
    // In our backend, simple disconnection/re-bet handles cancels, or we can emit cancel event
    // For this prototype, we'll let users reset local state, but usually cancelling is instant:
    showToast('Bet cancelled', 'info');
    // Emitting disconnection or cancel to backend can be implemented if required,
    // let's do a socket emit or reset.
    socket.emit('cancelBet', { panelId });
  };

  const cashOut = () => {
    socket.emit('cashOut', { panelId });
  };

  const getBtnState = () => {
    if (status === 'waiting') {
      return betPlaced ? 'waiting' : 'bet';
    }
    if (status === 'flying') {
      if (betPlaced && !cashedOut) return 'cashout';
      if (cashedOut) return 'cashed';
      return 'bet'; // default disabled
    }
    return 'bet';
  };

  const btnState = getBtnState();

  const handleAction = () => {
    if (btnState === 'bet') {
      placeBet();
    } else if (btnState === 'waiting') {
      cancelBet();
    } else if (btnState === 'cashout') {
      cashOut();
    }
  };

  return (
    <div className="bet-box animate-fade-in">
      {/* Bet Box Header with Manual / Auto Toggles */}
      <div className="bet-box-header">
        <span className="bet-box-title">Panel {panelId}</span>
        <div className="bet-tabs">
          <div className={`bet-tab ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>
            Manual
          </div>
          <div className={`bet-tab ${mode === 'auto' ? 'active' : ''}`} onClick={() => setMode('auto')}>
            Auto
          </div>
        </div>
      </div>

      {/* Main Row: Counter Input & BET Button */}
      <div className="bet-body-row">
        <div className="bet-inputs-col">
          {/* - Amount + Input */}
          <div className="bet-input-row">
            <button className="bet-adj-btn" onClick={() => setAmount(a => Math.max(1, a - 50))}>
              −
            </button>
            <input 
              className="bet-input" 
              type="number" 
              title="Bet amount input"
              value={amount} 
              onChange={e => setAmount(Math.max(1, Number(e.target.value)))} 
              disabled={betPlaced}
            />
            <button className="bet-adj-btn" onClick={() => setAmount(a => a + 50)}>
              +
            </button>
          </div>

          {/* Presets Row */}
          <div className="bet-quick">
            {[100, 200, 500, 1000].map(v => (
              <button 
                key={v} 
                className="bet-quick-btn" 
                onClick={() => setAmount(v)}
                disabled={betPlaced}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* BET BUTTON */}
        <button 
          className={`action-btn ${btnState}`} 
          onClick={handleAction}
          disabled={status === 'flying' && !betPlaced}
        >
          {btnState === 'bet' && (
            <>
              <span className="action-btn-main-text">BET</span>
              <span className="action-btn-sub-text">{amount.toLocaleString()} USD</span>
            </>
          )}
          {btnState === 'waiting' && (
            <>
              <span className="action-btn-main-text btn-text-cancel">CANCEL</span>
              <span className="action-btn-sub-text">{amount.toLocaleString()} USD</span>
            </>
          )}
          {btnState === 'cashout' && (
            <>
              <span className="action-btn-main-text">CASH OUT</span>
              <span className="action-btn-sub-text">{(currentBet * mult).toFixed(2)} USD</span>
            </>
          )}
          {btnState === 'cashed' && (
            <>
              <span className="action-btn-main-text btn-text-cashed-main">CASHED OUT</span>
              <span className="action-btn-sub-text btn-text-cashed-sub">✓ OK</span>
            </>
          )}
        </button>
      </div>

      {/* Auto Bet panel Options */}
      {mode === 'auto' && (
        <div className="auto-panel-row">
          <div className="auto-toggle-wrapper">
            <span className="auto-toggle-label">Auto Bet</span>
            <label className="switch">
              <input type="checkbox" checked={isAutoBet} onChange={e => setIsAutoBet(e.target.checked)} title="Auto Bet" />
              <span className="slider"></span>
            </label>
          </div>

          <div className="auto-cashout-box">
            <span className="auto-toggle-label">Auto Cashout</span>
            <label className="switch">
              <input type="checkbox" checked={isAutoCashout} onChange={e => setIsAutoCashout(e.target.checked)} title="Auto Cashout" />
              <span className="slider"></span>
            </label>
            <div className="auto-cashout-input-wrapper">
              <input 
                className="auto-cashout-input" 
                type="number" 
                step="0.1" 
                placeholder="2.00" 
                title="Auto cashout multiplier"
                value={autoCashout} 
                onChange={e => setAutoCashout(e.target.value)} 
                disabled={!isAutoCashout}
              />
              <span className="auto-cashout-x">x</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SIDE STATS PANEL (ALL BETS, MY BETS, TOP) ──────────────────────────────
function LiveBetsPanel() {
  const { liveBets, user, gameState } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'top'>('all');
  const [betHistory, setBetHistory] = useState<any[]>([]);

  // Compute stats info
  const totalBetAmount = liveBets.reduce((acc, b) => acc + b.amount, 0);

  // Mask name for realistic multiplayer look
  const maskName = (name: string) => {
    if (name.length <= 3) return name;
    return name.substring(0, 2) + '***' + name.substring(name.length - 1);
  };

  // Fetch persistent bet history when 'My Bets' is active
  useEffect(() => {
    if (activeTab === 'my' && user?.name) {
      console.log('Fetching bet history for:', user.name);
      fetch(`${BACKEND_URL}/api/user/bets?userName=${encodeURIComponent(user.name)}`)
        .then(res => res.json())
        .then(data => {
          console.log('Fetched history data:', data);
          setBetHistory(data);
        })
        .catch(err => console.error('Failed to load bet history:', err));
    }
  }, [activeTab, user?.name, gameState.status]); // Refresh history when round crashes/restarts

  // Filter bets based on active tab
  const getFilteredBets = () => {
    if (activeTab === 'all') return liveBets;
    if (activeTab === 'my') {
      // Current active bets + Historical bets
      const active = liveBets.filter(b => b.name === user?.name);
      // Map historical bets to same format
      const history = betHistory.map(h => ({
        name: h.userName,
        amount: h.amount,
        mult: h.mult,
        cashedOut: h.cashedOut,
        isHistory: true,
        time: h.createdAt
      }));
      return [...active, ...history];
    }
    // Top bets filter
    return [...liveBets].sort((a, b) => (b.mult || 0) - (a.mult || 0));
  };

  return (
    <div className="left-panel animate-fade-in">
      <div className="left-panel-header">
        <div className="round-summary-bar">
          <span className="bets-count-label">All Bets ({liveBets.length})</span>
          <span className="bets-sum-val">Total: {totalBetAmount.toLocaleString()} USD</span>
        </div>

        <div className="panel-tabs">
          <div className={`panel-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All Bets
          </div>
          <div className={`panel-tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>
            My Bets
          </div>
          <div className={`panel-tab ${activeTab === 'top' ? 'active' : ''}`} onClick={() => setActiveTab('top')}>
            Top
          </div>
        </div>
      </div>

      <div className="stats-table-header">
        <span className="stats-header-user">User / Time</span>
        <span className="align-center">Bet (USD)</span>
        <span className="align-center">Mult</span>
        <span className="align-right">Win / Cashout</span>
      </div>

      <div className="panel-body">
        {getFilteredBets().length === 0 && (
          <div className="stats-empty-label">
            No bets found
          </div>
        )}
        {getFilteredBets().map((p: any, i) => {
          const initials = p.name.substring(0, 2).toUpperCase();
          const hasWon = p.cashedOut;
          
          return (
            <div key={i} className={`player-row ${hasWon ? 'won' : ''} ${p.isHistory ? 'history-row' : ''}`}>
              <div className="player-info-cell">
                <div className="player-avatar-mini">{initials}</div>
                <div className="player-name-col">
                  <span className="player-name-lbl">{maskName(p.name)}</span>
                  {p.isHistory && <span className="player-time-lbl">{new Date(p.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                </div>
              </div>
              
              <div className="player-bet-cell">
                {p.amount.toLocaleString()}
              </div>

              <div className="player-mult-cell">
                {hasWon && p.mult ? (
                  <span className="player-mult-pill won">{p.mult.toFixed(2)}x</span>
                ) : p.isHistory ? (
                  <span className="player-mult-pill lost">{p.mult ? p.mult.toFixed(2) : '-'}x</span>
                ) : (
                  <span className="player-mult-pill waiting">-</span>
                )}
              </div>

              <div className="player-win-cell">
                {hasWon && p.mult ? (
                  `$${Math.floor(p.amount * p.mult).toLocaleString()}`
                ) : (
                  '-'
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GamePage() {
  const { history } = useApp();
  const [mobileView, setMobileView] = useState<'game' | 'bets'>('game');

  return (
    <div className="game-wrapper">
      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      <div className="mobile-view-nav">
        <button 
          className={`mob-nav-btn ${mobileView === 'game' ? 'active' : ''}`}
          onClick={() => setMobileView('game')}
        >
          🎮 GAME
        </button>
        <button 
          className={`mob-nav-btn ${mobileView === 'bets' ? 'active' : ''}`}
          onClick={() => setMobileView('bets')}
        >
          📊 ALL BETS
        </button>
      </div>

      {/* Left Columns - Live bets statistics (Hidden on mobile if not in 'bets' view) */}
      <div className={`side-panel-wrapper ${mobileView === 'bets' ? 'mob-visible' : 'mob-hidden'}`}>
        <LiveBetsPanel />
      </div>

      {/* Main Center Area (Hidden on mobile if not in 'game' view) */}
      <div className={`center-panel-wrapper ${mobileView === 'game' ? 'mob-visible' : 'mob-hidden'}`}>
        <div className="center-panel">
          {/* Dynamic history line */}
          <HistoryBar history={history} />

          {/* Flight canvas simulation panel */}
          <div className="canvas-container">
            <GameCanvas />
            <MultOverlay />
          </div>

          {/* Two Independent Betting Controllers side-by-side */}
          <div className="bet-controls">
            <BetBox panelId={1} />
            <BetBox panelId={2} />
          </div>
        </div>
      </div>
    </div>
  );
}
