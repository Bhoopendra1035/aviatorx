import React, { useState, useEffect } from 'react';
import { useApp, ToastContainer, BACKEND_URL } from './store';
import GamePage from './pages/GamePage';
import AuthPage from './pages/AuthPage';

// ─── DEPOSIT FUNDS MODAL ─────────────────────────────────────────────────────
const UPI_ID = 'bhoopendratale8@okaxis';
const UPI_NAME = 'Bhoopendra';

function DepositModal({ onClose }: { onClose: () => void }) {
  const { socket, user, showToast } = useApp();
  const [step, setStep] = useState<'amount' | 'qr' | 'done'>('amount');
  const [customAmt, setCustomAmt] = useState(500);
  const [selectedAmt, setSelectedAmt] = useState<number>(0);
  const [utrNumber, setUtrNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const qrUrl = selectedAmt
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${UPI_ID}%26pn=${UPI_NAME}%26am=${selectedAmt}%26cu=INR`
    : '';

  const handleAmountSelect = (v: number) => {
    setSelectedAmt(v);
    setStep('qr');
  };

  const handleSubmitUTR = () => {
    const utr = utrNumber.trim();
    if (!utr || utr.length < 6) return showToast('Please enter a valid UTR / Transaction number', 'error');
    if (!selectedAmt || selectedAmt < 10) return showToast('Invalid amount', 'error');

    setIsSubmitting(true);
    socket.emit('depositRequest', {
      amount: selectedAmt,
      utrNumber: utr,
      userName: user?.name || 'Unknown',
    });
    setStep('done');
    setIsSubmitting(false);
    showToast('✅ Deposit request submitted! Awaiting admin approval.', 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-close-x" onClick={onClose}>×</div>
        <div className="modal-title">💰 Deposit Funds</div>

        {/* ── STEP 1: Choose Amount ── */}
        {step === 'amount' && (
          <>
            <div className="modal-sub">Choose amount to deposit via UPI</div>
            <div className="pay-methods">
              <div className="pay-method active">
                <div className="pay-icon">📱</div>
                <div className="pay-name">UPI</div>
                <div className="pay-sub">GPay / PhonePe / Paytm</div>
              </div>
              <div className="pay-method pay-method-disabled">
                <div className="pay-icon">💳</div>
                <div className="pay-name">Card</div>
                <div className="pay-sub">Unavailable</div>
              </div>
            </div>
            <div className="amount-grid">
              {[100, 200, 500, 1000, 2000, 5000].map(v => (
                <div key={v} className="amount-btn" onClick={() => handleAmountSelect(v)}>₹{v.toLocaleString()}</div>
              ))}
            </div>
            <div className="form-group form-group-mt12">
              <label className="form-label">Or Custom Amount (₹)</label>
              <div className="flex-gap8">
                <input className="form-input" type="number" title="Custom amount" min={10}
                  value={customAmt} onChange={e => setCustomAmt(Number(e.target.value))} />
                <button className="btn-yellow btn-next" onClick={() => handleAmountSelect(customAmt)}>Next →</button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: QR + UTR Entry ── */}
        {step === 'qr' && (
          <>
            <div className="modal-sub">Scan & pay, then enter your UTR number</div>

            {/* UPI details card */}
            <div className="dep-upi-card">
              <div className="dep-qr-wrap">
                <img src={qrUrl} alt="Scan to Pay" width={150} height={150} className="dep-qr-img" />
              </div>
              <div className="dep-upi-info">
                <div className="dep-upi-row">
                  <span className="dep-upi-lbl">UPI ID</span>
                  <span className="dep-upi-val">{UPI_ID}</span>
                </div>
                <div className="dep-upi-row">
                  <span className="dep-upi-lbl">Payee</span>
                  <span className="dep-upi-val">{UPI_NAME}</span>
                </div>
                <div className="dep-upi-row">
                  <span className="dep-upi-lbl">Amount</span>
                  <span className="dep-upi-amt">₹{selectedAmt.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="dep-steps-tip">
              <div className="dep-step-row"><span className="dep-step-num">1</span> Open GPay / PhonePe / Paytm</div>
              <div className="dep-step-row"><span className="dep-step-num">2</span> Scan the QR code or send to UPI ID above</div>
              <div className="dep-step-row"><span className="dep-step-num">3</span> After payment, enter the UTR / Transaction ID below</div>
            </div>

            <div className="form-group form-group-mt12">
              <label className="form-label">🔢 UTR / Transaction Reference Number</label>
              <input
                className="form-input dep-utr-input"
                type="text"
                placeholder="Enter 12-digit UTR number from your payment app"
                value={utrNumber}
                onChange={e => setUtrNumber(e.target.value)}
                maxLength={30}
              />
              <div className="dep-utr-hint">
                Find UTR in your payment app → Transaction History → Reference / UTR No.
              </div>
            </div>

            <button className="btn-yellow" onClick={handleSubmitUTR} disabled={isSubmitting}>
              {isSubmitting ? '⏳ Submitting...' : '📤 Submit Deposit Request'}
            </button>
            <button className="btn-outline btn-mt8" onClick={() => setStep('amount')}>← Change Amount</button>
          </>
        )}

        {/* ── STEP 3: Success / Pending ── */}
        {step === 'done' && (
          <div className="dep-success-wrap">
            <div className="dep-success-icon">⏳</div>
            <div className="dep-success-title">Request Submitted!</div>
            <div className="dep-success-msg">
              Your deposit request of <strong>₹{selectedAmt.toLocaleString()}</strong> with UTR <strong>{utrNumber}</strong> has been sent to the admin.
            </div>
            <div className="dep-success-sub">
              Admin will verify your payment and credit <strong>{selectedAmt} 🪙</strong> to your wallet shortly.
            </div>
            <button className="btn-yellow" onClick={onClose}>Got it! 👍</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WITHDRAW MODAL ──────────────────────────────────────────────────────────
function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { bal, socket, addTx, showToast } = useApp();
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [upiAddress, setUpiAddress] = useState('');

  const handleWithdraw = () => {
    const amt = parseInt(withdrawAmt);
    if (!amt || amt < 100) return showToast('Minimum withdrawal is 100 🪙', 'error');
    if (!upiAddress.includes('@')) return showToast('Please enter a valid UPI address', 'error');
    if (amt > bal) return showToast('Insufficient balance!', 'error');

    socket.emit('withdraw', amt);
    addTx({ label: `Withdrawal to ${upiAddress}`, amount: amt, plus: false, time: new Date().toLocaleTimeString() });
    showToast(`₹${amt} withdrawal request submitted to ${upiAddress}! 🏦`, 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-close-x" onClick={onClose}>×</div>
        <div className="modal-title">🏦 Cash Out Winnings</div>
        <div className="modal-sub">Withdraw demo balance to your UPI account</div>

        <div className="form-group">
          <label className="form-label">Available Balance</label>
          <div className="bal-display-text">
            {bal.toLocaleString()} 🪙 (= ₹{bal.toLocaleString()})
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Withdrawal Amount (🪙)</label>
          <input className="form-input" type="number" placeholder="Min 100" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Your UPI Address (ID)</label>
          <input className="form-input" type="text" placeholder="example@paytm" value={upiAddress} onChange={e => setUpiAddress(e.target.value)} />
        </div>

        <div className="modal-tip">
          Withdrawals are processed instantly on our automated system. Please ensure your UPI ID is correct.
        </div>

        <button className="btn-yellow" onClick={handleWithdraw}>Submit Withdrawal →</button>
      </div>
    </div>
  );
}

// ─── HOW TO PLAY INFOGRAPHIC MODAL ───────────────────────────────────────────
function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate-fade-in modal-width480" onClick={e => e.stopPropagation()}>
        <div className="modal-close-x" onClick={onClose}>×</div>
        <div className="modal-title modal-title-red">✈️ How to Play Aviator</div>
        <div className="modal-sub">Master the crash gaming concept in 3 easy steps!</div>

        <div className="modal-info-list">
          <div className="flex-gap12">
            <div className="step-num step-num-red">1</div>
            <div>
              <strong className="step-title">PLACE YOUR BET</strong>
              <span className="step-desc">Choose your bet amount and click "BET". You can place up to two bets simultaneously to double the fun!</span>
            </div>
          </div>
          
          <div className="flex-gap12">
            <div className="step-num step-num-orange">2</div>
            <div>
              <strong className="step-title">WATCH THE PLANE FLY</strong>
              <span className="step-desc">As the plane takes off, the multiplier grows dynamically! The higher the plane flies, the more you win.</span>
            </div>
          </div>

          <div className="flex-gap12">
            <div className="step-num step-num-green">3</div>
            <div>
              <strong className="step-title">CASH OUT BEFORE CRASH</strong>
              <span className="step-desc">Click "CASH OUT" to secure your winnings based on the current multiplier. If the plane flies away before you cash out, you lose your bet!</span>
            </div>
          </div>
        </div>

        <button className="btn-yellow" onClick={onClose}>Got It! Let's Play</button>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD PANEL ───────────────────────────────────────────────────
function AdminDashboardModal({ onClose }: { onClose: () => void }) {
  const { socket, adminUsers, adminRounds, gameState, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'control' | 'customers' | 'rounds' | 'deposits' | 'settings'>('control');
  const [nextCrash, setNextCrash] = useState('');
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  
  // Database States loaded via API
  const [allDbUsers, setAllDbUsers] = useState<any[]>([]);
  const [allDbRounds, setAllDbRounds] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Settings tab states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminConfirmPass, setNewAdminConfirmPass] = useState('');
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);

  const fetchFullData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/full-data`);
      if (res.ok) {
        const data = await res.json();
        setAllDbUsers(data.allUsers || []);
        setAllDbRounds(data.allRounds || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin full data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFullData();
    const handleUsersUpdate = () => { fetchFullData(); };
    socket.on('adminUsersUpdate', handleUsersUpdate);

    // Listen for live deposit request updates
    socket.on('adminDepositsUpdate', (deps: any[]) => setPendingDeposits(deps));
    // Ask server to send current pending deposits on mount
    socket.emit('getAdminDeposits');

    return () => {
      socket.off('adminUsersUpdate', handleUsersUpdate);
      socket.off('adminDepositsUpdate');
    };
  }, [socket]);

  // Load current admin config from DB when Settings tab is active
  useEffect(() => {
    if (activeTab === 'settings') {
      fetch(`${BACKEND_URL}/api/auth/admin-credentials`)
        .then(res => res.json())
        .then(data => {
          if (data && data.email) {
            setNewAdminEmail(data.email);
          }
        })
        .catch(err => console.error('Failed to load admin email for update:', err));
    }
  }, [activeTab]);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPass) {
      showToast('⚠️ Please fill out all fields.', 'error');
      return;
    }
    if (newAdminPass !== newAdminConfirmPass) {
      showToast('⚠️ Passwords do not match.', 'error');
      return;
    }
    if (newAdminPass.length < 6) {
      showToast('⚠️ Password must be at least 6 characters.', 'error');
      return;
    }

    setIsUpdatingCreds(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/update-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail, password: newAdminPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Admin credentials updated successfully!', 'success');
        setNewAdminPass('');
        setNewAdminConfirmPass('');
      } else {
        showToast(`❌ Update failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast('❌ Server connection error.', 'error');
    } finally {
      setIsUpdatingCreds(false);
    }
  };

  const setTarget = () => {
    const v = parseFloat(nextCrash);
    if (isNaN(v) || v < 1.01) return showToast('Enter a valid multiplier ≥ 1.01', 'error');
    socket.emit('setNextCrash', v);
    setNextCrash('');
  };

  // Filter users based on search query
  const filteredUsers = allDbUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Round stats analytics calculations
  const totalRounds = allDbRounds.length;
  const avgMultiplier = totalRounds > 0 
    ? +(allDbRounds.reduce((acc, r) => acc + r.m, 0) / totalRounds).toFixed(2)
    : 1.00;
  const maxMultiplier = totalRounds > 0
    ? Math.max(...allDbRounds.map(r => r.m))
    : 1.00;
  const totalCoinsPool = allDbUsers.reduce((acc, u) => acc + u.bal, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate-fade-in admin-modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-close-x" onClick={onClose}>×</div>
        <div className="admin-header-flex">
          <div className="modal-title modal-title-red modal-title-no-margin">🛡️ Admin Control Centre</div>
          <button className="btn-return-website" onClick={onClose}>
            ⬅️ Go to Website
          </button>
        </div>
        <div className="modal-sub">Manage rounds, set targets, and manage players in real-time.</div>

        {/* Tab Buttons Navigation */}
        <div className="admin-tabs-row">
          <button className={`admin-tab-btn ${activeTab === 'control' ? 'active' : ''}`} onClick={() => setActiveTab('control')}>
            🎯 Control Room
          </button>
          <button className={`admin-tab-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
            👥 Customers DB ({allDbUsers.length})
          </button>
          <button className={`admin-tab-btn ${activeTab === 'rounds' ? 'active' : ''}`} onClick={() => setActiveTab('rounds')}>
            📈 Round Stats ({totalRounds})
          </button>
          <button className={`admin-tab-btn dep-tab-btn ${activeTab === 'deposits' ? 'active' : ''}`} onClick={() => setActiveTab('deposits')}>
            💰 Deposits {pendingDeposits.length > 0 && <span className="dep-badge">{pendingDeposits.length}</span>}
          </button>
          <button className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            ⚙️ Settings
          </button>
        </div>

        {/* =========================================================================
            TAB 1: CONTROL ROOM (Live Round Controls)
           ========================================================================= */}
        {activeTab === 'control' && (
          <div className="admin-tab-content animate-fade-in">
            {/* Current Round Info */}
            <div className="admin-status-grid">
              <div>
                <div className="admin-stat-lbl">Connected Players</div>
                <div className="admin-stat-val val-green">{adminUsers.length}</div>
              </div>
              <div>
                <div className="admin-stat-lbl">Game status</div>
                <div className={`admin-stat-val text-uppercase ${gameState.status === 'flying' ? 'val-green' : 'val-orange'}`}>
                  {gameState.status} {gameState.status === 'flying' ? `(${gameState.mult.toFixed(2)}x)` : ''}
                </div>
              </div>
            </div>

            {/* Next Crash Target */}
            <div className="admin-section-box">
              <div className="admin-section-title">🎯 Next Crash Multiplier Target</div>
              <div className="flex-gap8">
                <input className="form-input flex1" type="number" step="0.01" min="1.01" placeholder="e.g. 5.00" value={nextCrash} onChange={e => setNextCrash(e.target.value)} />
                <button className="btn-yellow btn-next" onClick={setTarget}>Set Target</button>
              </div>
              {gameState.status === 'flying' && (
                <button className="btn-force-crash" onClick={() => socket.emit('forceCrash')}>
                  💥 Force Crash Immediately
                </button>
              )}
            </div>

            {/* Next 5 Pre-Calculated Round Multipliers */}
            <div className="admin-section-box">
              <div className="admin-section-title">🔮 Pre-Calculated Future Scores (Next 5 Rounds)</div>
              <div className="admin-rounds-preview-row">
                {adminRounds && adminRounds.length > 0 ? (
                  adminRounds.map((r, i) => {
                    const getPillClass = (val: number) => {
                      if (val < 2.0) return 'low';
                      if (val < 10.0) return 'mid';
                      return 'high';
                    };
                    return (
                      <div key={i} className={`admin-round-pill ${getPillClass(r)}`}>
                        <span className="admin-round-idx">#{i+1}</span>
                        <span className="admin-round-val">{r.toFixed(2)}x</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="admin-waiting-label">Waiting for future scores...</span>
                )}
              </div>
            </div>

            {/* Connected Users Table */}
            <div className="admin-table-container">
              <div className="admin-section-title">👥 Active Player Sockets</div>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr className="admin-th-row">
                      <th className="admin-th-cell">Name</th>
                      <th className="admin-th-cell">Balance</th>
                      <th className="admin-th-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.length === 0 && (
                      <tr><td colSpan={3} className="admin-no-users">No users online</td></tr>
                    )}
                    {adminUsers.map(u => (
                      <tr key={u.id} className="admin-tr-row">
                        <td className="admin-td-name">{u.name} {u.isAdmin && <span className="admin-tag-red">(Admin)</span>}</td>
                        <td className="admin-td-bal">{u.bal.toLocaleString()} 🪙</td>
                        <td className="admin-td-actions">
                          <button className="admin-btn-gift" 
                            onClick={() => { socket.emit('addBal', { id: u.id, amount: 500 }); showToast(`Gifted 500 🪙 to ${u.name}!`, 'success'); }}>+500</button>
                          {!u.isAdmin && (
                            <button className="admin-btn-kick" 
                              onClick={() => { socket.emit('kickUser', u.id); showToast(`Kicked socket ${u.name}`, 'info'); }}>Kick</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CUSTOMERS DATABASE
           ========================================================================= */}
        {activeTab === 'customers' && (
          <div className="admin-tab-content animate-fade-in">
            {/* Search filter input */}
            <div className="admin-search-wrapper">
              <input 
                className="form-input admin-search-input" 
                type="text" 
                placeholder="🔍 Search customer name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button className="btn-refresh" onClick={fetchFullData} title="Refresh Database">🔄 Refresh</button>
            </div>

            <div className="admin-table-container">
              <div className="admin-section-title">👥 All Registered Customers ({filteredUsers.length})</div>
              <div className="admin-table-scroll customer-table-height">
                <table className="admin-table">
                  <thead>
                    <tr className="admin-th-row">
                      <th className="admin-th-cell">Customer Name</th>
                      <th className="admin-th-cell">Balance</th>
                      <th className="admin-th-cell">Privileges</th>
                      <th className="admin-th-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={4} className="admin-no-users">No customer found</td></tr>
                    )}
                    {filteredUsers.map(u => (
                      <tr key={u._id} className="admin-tr-row">
                        <td className="admin-td-name">
                          <span className="admin-customer-name">{u.name}</span>
                          <div className="admin-customer-date">Registered: {new Date(u.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="admin-td-bal admin-td-bal-green">
                          {u.bal.toLocaleString()} 🪙
                        </td>
                        <td>
                          {u.isAdmin ? (
                            <span className="admin-role-badge admin">Admin</span>
                          ) : (
                            <span className="admin-role-badge user">User</span>
                          )}
                        </td>
                        <td className="admin-td-actions">
                          {/* Edit Balance */}
                          <button className="admin-btn-action edit" onClick={() => {
                            const val = prompt(`Enter new balance for ${u.name}:`, u.bal);
                            if (val !== null && !isNaN(parseInt(val))) {
                              socket.emit('adminEditBalance', { userId: u._id, bal: parseInt(val) });
                            }
                          }} title="Edit Balance">📝 Bal</button>

                          {/* Toggle Admin */}
                          <button className="admin-btn-action role" onClick={() => {
                            if (confirm(`Toggle administrator privileges for ${u.name}?`)) {
                              socket.emit('adminToggleAdmin', { userId: u._id });
                            }
                          }} title="Toggle Admin Role">🛡️ Role</button>

                          {/* Delete customer */}
                          <button className="admin-btn-action delete" onClick={() => {
                            if (confirm(`⚠️ WARNING: Are you absolutely sure you want to delete ${u.name} from database? This cannot be undone!`)) {
                              socket.emit('adminDeleteUser', { userId: u._id });
                            }
                          }} title="Delete User">🗑️ Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: ROUNDS HISTORY & ANALYTICS
           ========================================================================= */}
        {activeTab === 'rounds' && (
          <div className="admin-tab-content animate-fade-in">
            {/* Analytics KPI Dashboard Grid */}
            <div className="admin-analytics-grid">
              <div className="analytics-card">
                <div className="analytics-lbl">Total Rounds</div>
                <div className="analytics-val">{totalRounds}</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-lbl">Avg Multiplier</div>
                <div className="analytics-val val-blue">{avgMultiplier}x</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-lbl">Max Multiplier</div>
                <div className="analytics-val val-orange">{maxMultiplier}x</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-lbl">Total Coins Circulation</div>
                <div className="analytics-val val-green">{totalCoinsPool.toLocaleString()}</div>
              </div>
            </div>

            <div className="admin-table-container">
              <div className="admin-section-title">📊 Previous Rounds Log (Last 100 Rounds)</div>
              <div className="admin-table-scroll customer-table-height">
                <table className="admin-table">
                  <thead>
                    <tr className="admin-th-row">
                      <th className="admin-th-cell">Round Sequence</th>
                      <th className="admin-th-cell">Crash Multiplier</th>
                      <th className="admin-th-cell">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDbRounds.length === 0 && (
                      <tr><td colSpan={3} className="admin-no-users">No rounds played yet</td></tr>
                    )}
                    {allDbRounds.map((r, i) => {
                      const getCellColorClass = (val: number) => {
                        if (val < 2.0) return 'val-blue';
                        if (val < 10.0) return 'val-purple';
                        return 'val-pink';
                      };
                      return (
                        <tr key={r._id || i} className="admin-tr-row">
                          <td className="admin-td-name admin-td-bold">Round #{r.round}</td>
                          <td className={`admin-td-bal admin-td-bolder ${getCellColorClass(r.m)}`}>
                            {r.m.toFixed(2)}x
                          </td>
                          <td className="admin-td-muted">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: DEPOSIT REQUESTS
           ========================================================================= */}
        {activeTab === 'deposits' && (
          <div className="admin-tab-content animate-fade-in">
            <div className="dep-admin-header">
              <div className="admin-section-title">💰 Deposit Requests ({pendingDeposits.length})</div>
              <button className="btn-refresh" onClick={() => socket.emit('getAdminDeposits')} title="Refresh">🔄 Refresh</button>
            </div>

            {pendingDeposits.length === 0 ? (
              <div className="dep-empty-state">
                <div className="dep-empty-icon">📭</div>
                <div className="dep-empty-text">No deposit requests yet</div>
              </div>
            ) : (
              <div className="admin-table-scroll dep-table-height">
                <table className="admin-table">
                  <thead>
                    <tr className="admin-th-row">
                      <th className="admin-th-cell">Player</th>
                      <th className="admin-th-cell">Amount</th>
                      <th className="admin-th-cell">UTR Number</th>
                      <th className="admin-th-cell">Time</th>
                      <th className="admin-th-cell">Status</th>
                      <th className="admin-th-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDeposits.map((dep: any) => (
                      <tr key={dep.id} className="admin-tr-row">
                        <td className="admin-td-name admin-customer-name">{dep.userName}</td>
                        <td className="admin-td-bal val-green admin-td-bolder">₹{dep.amount.toLocaleString()}</td>
                        <td className="dep-utr-cell">{dep.utrNumber}</td>
                        <td className="admin-td-muted">{new Date(dep.time).toLocaleString()}</td>
                        <td>
                          {dep.status === 'pending' && <span className="dep-status-badge pending">⏳ Pending</span>}
                          {dep.status === 'approved' && <span className="dep-status-badge approved">✅ Approved</span>}
                          {dep.status === 'rejected' && <span className="dep-status-badge rejected">❌ Rejected</span>}
                        </td>
                        <td className="admin-td-actions">
                          {dep.status === 'pending' && (
                            <>
                              <button className="admin-btn-action edit dep-approve-btn"
                                onClick={() => {
                                  socket.emit('adminApproveDeposit', { depositId: dep.id });
                                  showToast(`✅ Approved ₹${dep.amount} for ${dep.userName}`, 'success');
                                }}>
                                ✅ Approve
                              </button>
                              <button className="admin-btn-action delete"
                                onClick={() => {
                                  socket.emit('adminRejectDeposit', { depositId: dep.id });
                                  showToast(`❌ Rejected deposit for ${dep.userName}`, 'info');
                                }}>
                                ❌ Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 5: CREDENTIALS SETTINGS (Update Admin Email & Password)
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="admin-tab-content animate-fade-in">
            <h3 className="admin-tab-title">🔐 Admin Security Settings</h3>
            <div className="admin-card">
              <form onSubmit={handleUpdateCredentials} className="admin-settings-form">
                <div className="admin-settings-form-group">
                  <label className="admin-settings-form-label">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="admin@aviator.com"
                    className="admin-settings-form-input"
                    required
                  />
                </div>

                <div className="admin-settings-form-group">
                  <label className="admin-settings-form-label">
                    New Admin Password
                  </label>
                  <input
                    type="password"
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    placeholder="Min 6 characters"
                    className="admin-settings-form-input"
                    required
                  />
                </div>

                <div className="admin-settings-form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="admin-settings-form-label">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={newAdminConfirmPass}
                    onChange={(e) => setNewAdminConfirmPass(e.target.value)}
                    placeholder="Repeat new password"
                    className="admin-settings-form-input"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingCreds}
                  className="admin-btn-action edit admin-settings-form-submit"
                  style={{
                    cursor: isUpdatingCreds ? 'not-allowed' : 'pointer',
                    opacity: isUpdatingCreds ? 0.7 : 1
                  }}
                >
                  {isUpdatingCreds ? '⏳ Updating Credentials...' : '💾 Save & Apply Credentials'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── MAIN APP CONTAINER ──────────────────────────────────────────────────────
export default function App() {
  const { user, setUser, bal, isMuted, setIsMuted } = useApp();
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Unauthenticated screen
  if (!user) {
    return (
      <div className="app-layout">
        <AuthPage />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sleek navigation bar */}
      <nav className="navbar">
        <div className="nav-left-group">
          <div className="brand-wrapper" onClick={() => setShowHowToPlay(true)}>
            {/* Standard Spribe SVG plane red graphic logo */}
            <svg className="brand-logo-img" viewBox="0 0 100 100" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 80 L35 45 L70 45 L85 55 L75 60 L60 52 L35 52 L25 80 Z" fill="#e11d48"/>
              <path d="M35 45 L50 20 L60 20 L52 45 Z" fill="#be123c"/>
              <circle cx="28" cy="48" r="4" fill="#fff"/>
            </svg>
            <div className="brand-text">Aviator<span>Spribe</span></div>
          </div>
          <button className="how-to-play-btn" onClick={() => setShowHowToPlay(true)}>💡 How to Play</button>
        </div>

        <div className="nav-right-group">
          {user.isAdmin && (
            <button className="nav-admin-link-btn" onClick={() => setShowAdmin(true)}>
              🛡️ Admin Control
            </button>
          )}
          <button 
            className="audio-toggle-btn" 
            title={isMuted ? "Unmute Sound" : "Mute Sound"} 
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <div className="balance-wrapper" onClick={() => setShowWithdraw(true)} title="Click to Withdraw">
            <span className="balance-amount">
              {bal.toLocaleString()}
              <span className="balance-currency">USD</span>
            </span>
            <button className="nav-deposit-btn" onClick={(e) => { e.stopPropagation(); setShowDeposit(true); }}>Deposit</button>
          </div>
          {/* Avatar / Log out trigger */}
          <div className="nav-avatar" title="Click to Logout" onClick={() => setUser(null)}>
            {user.name.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </nav>

      <ToastContainer />

      {/* Main Single Screen Game Panel */}
      <GamePage />

      {/* Admin dashboard switch overlay toggle badge */}
      {user.isAdmin && (
        <button className="admin-badge-trigger animate-bounce" onClick={() => setShowAdmin(true)} title="Admin Control Panel">
          🛡️
        </button>
      )}

      {/* Render Single overlays */}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {showAdmin && <AdminDashboardModal onClose={() => setShowAdmin(false)} />}
    </div>
  );
}
