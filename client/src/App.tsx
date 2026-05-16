import React, { useState, useEffect } from 'react';
import { useApp, ToastContainer, BACKEND_URL } from './store';
import GamePage from './pages/GamePage';
import AuthPage from './pages/AuthPage';

// ─── DEPOSIT FUNDS MODAL ─────────────────────────────────────────────────────
const UPI_ID = 'bh62631912@jio';
const UPI_NAME = 'Aviatorx';

function DepositModal({ onClose }: { onClose: () => void }) {
  const { socket, user, showToast } = useApp();
  const [step, setStep] = useState<'amount' | 'qr' | 'done'>('amount');
  const [customAmt, setCustomAmt] = useState(300);
  const [selectedAmt, setSelectedAmt] = useState<number>(0);
  const [utrNumber, setUtrNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const qrUrl = selectedAmt
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${UPI_ID}%26pn=${UPI_NAME}%26am=${selectedAmt}%26cu=INR`
    : '';

  const handleAmountSelect = (v: number) => {
    if (v < 300) return showToast('Minimum deposit amount is ₹300', 'error');
    setSelectedAmt(v);
    setStep('qr');
  };

  const handleSubmitUTR = () => {
    const utr = utrNumber.trim();
    if (!utr || utr.length !== 12) return showToast('UTR number must be exactly 12 digits', 'error');
    if (!selectedAmt || selectedAmt < 300) return showToast('Invalid amount (min ₹300)', 'error');

    setIsSubmitting(true);
    socket.emit('depositRequest', {
      amount: selectedAmt,
      utrNumber: utr,
      userName: user?.name || 'Unknown',
    });
    setStep('done');
    setIsSubmitting(false);
    showToast('✅ Deposit request submitted! Approval in 3-5 mins.', 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-close-x" onClick={onClose}>×</div>
        <div className="modal-title">💰 Deposit Funds</div>

        {/* ── STEP 1: Choose Amount ── */}
        {step === 'amount' && (
          <>
            <div className="modal-sub">First, choose an amount to deposit (Min ₹300)</div>
            <div className="pay-methods">
              <div className="pay-method active">
                <div className="pay-icon">📱</div>
                <div className="pay-name">UPI Payment</div>
                <div className="pay-sub">Fast & Secure</div>
              </div>
            </div>
            <div className="amount-grid">
              {[300, 500, 1000, 2000, 5000].map(v => (
                <div key={v} className="amount-btn" onClick={() => handleAmountSelect(v)}>₹{v.toLocaleString()}</div>
              ))}
            </div>
            <div className="form-group form-group-mt12">
              <label className="form-label">Or Enter Custom Amount (₹)</label>
              <div className="flex-gap8">
                <input className="form-input" type="number" title="Custom amount" min={300}
                  value={customAmt} onChange={e => setCustomAmt(Number(e.target.value))} />
                <button className="btn-yellow btn-next" onClick={() => handleAmountSelect(customAmt)}>Next →</button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: QR + UTR Entry ── */}
        {step === 'qr' && (
          <>
            <div className="modal-sub">Scan QR & pay, then submit your 12-digit UTR</div>

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
                  <span className="dep-upi-lbl">Name</span>
                  <span className="dep-upi-val">{UPI_NAME}</span>
                </div>
                <div className="dep-upi-row">
                  <span className="dep-upi-lbl">Amount</span>
                  <span className="dep-upi-amt">₹{selectedAmt.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="dep-steps-tip">
              <div className="dep-step-row dep-step-note">
                ⚠️ NOTE: QR ya UPI payment karne ke baad hi UTR number dalein.
              </div>
              <div className="dep-step-row"><span className="dep-step-num">1</span> Scan the QR above and pay ₹{selectedAmt}</div>
              <div className="dep-step-row"><span className="dep-step-num">2</span> Enter the 12-digit UTR number from your payment app</div>
            </div>

            <div className="form-group form-group-mt12">
              <label className="form-label">🔢 12-Digit UTR Number</label>
              <input
                className="form-input dep-utr-input"
                type="text"
                placeholder="Enter exactly 12 digits"
                value={utrNumber}
                onChange={e => setUtrNumber(e.target.value.replace(/\D/g, ''))}
                maxLength={12}
              />
            </div>

            <button className="btn-yellow" onClick={handleSubmitUTR} disabled={isSubmitting}>
              {isSubmitting ? '⏳ Submitting...' : '📤 Submit UTR Number'}
            </button>
            <button className="btn-outline btn-mt8" onClick={() => setStep('amount')}>← Back to Amount</button>
          </>
        )}

        {/* ── STEP 3: Success ── */}
        {step === 'done' && (
          <div className="dep-success-wrap">
            <div className="dep-success-icon">✅</div>
            <div className="dep-success-title">Payment Submitted!</div>
            <div className="dep-success-msg">
              Aapka amount <strong>3-5 minute</strong> mein wallet mein aa jayega.
            </div>
            <div className="dep-success-sub">
              Admin is verifying your UTR: <strong>{utrNumber}</strong>
            </div>
            <button className="btn-yellow" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WITHDRAW MODAL ──────────────────────────────────────────────────────────
function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { bal, socket, addTx, showToast, user } = useApp();
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [method, setMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [upiAddress, setUpiAddress] = useState('');
  const [accNo, setAccNo] = useState('');
  const [ifsc, setIfsc] = useState('');

  useEffect(() => {
    if (user?.email) {
      const saved = localStorage.getItem(`bank_${user.email}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.accNo) setAccNo(parsed.accNo);
          if (parsed.ifsc) setIfsc(parsed.ifsc);
        } catch(e){}
      }
    }
  }, [user]);

  const handleWithdraw = () => {
    const amt = parseInt(withdrawAmt);
    if (!amt || amt < 500) return showToast('Minimum withdrawal is 500 🪙', 'error');
    if (amt > bal) return showToast('Insufficient balance!', 'error');

    if (method === 'UPI') {
      if (!upiAddress.includes('@')) return showToast('Please enter a valid UPI address', 'error');
      socket.emit('withdraw', { amount: amt, method: 'UPI', upiId: upiAddress });
      addTx({ label: `Withdrawal to ${upiAddress}`, amount: amt, plus: false, time: new Date().toLocaleTimeString() });
      showToast(`₹${amt} withdrawal request submitted to UPI (${upiAddress})! 🏦`, 'success');
    } else {
      if (!accNo || accNo.length < 6) return showToast('Please enter a valid Account Number', 'error');
      if (!ifsc || ifsc.length < 4) return showToast('Please enter a valid IFSC Code', 'error');
      socket.emit('withdraw', { amount: amt, method: 'Bank Transfer', accountNo: accNo, ifscCode: ifsc });
      addTx({ label: `Withdrawal to Bank (${accNo})`, amount: amt, plus: false, time: new Date().toLocaleTimeString() });
      showToast(`₹${amt} withdrawal request submitted to Bank Account! 🏦`, 'success');
      if (user?.email) {
        localStorage.setItem(`bank_${user.email}`, JSON.stringify({ accNo, ifsc }));
      }
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-close-x" onClick={onClose}>×</div>
        <div className="modal-title">🏦 Cash Out Winnings</div>
        <div className="modal-sub">Withdraw demo balance directly to your account</div>

        <div className="form-group">
          <label className="form-label">Available Balance</label>
          <div className="bal-display-text">
            {bal.toLocaleString()} 🪙 (= ₹{bal.toLocaleString()})
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Withdrawal Amount (🪙)</label>
          <input className="form-input" type="number" placeholder="Min 500" title="Withdrawal Amount" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Payout Method</label>
          <div className="payout-method-tabs">
            <button type="button" className={`payout-btn ${method === 'UPI' ? 'active' : ''}`} onClick={() => setMethod('UPI')}>📱 UPI Transfer</button>
            <button type="button" className={`payout-btn ${method === 'BANK' ? 'active' : ''}`} onClick={() => setMethod('BANK')}>🏦 Bank Transfer</button>
          </div>
        </div>

        {method === 'UPI' ? (
          <div className="form-group form-group-mt12">
            <label className="form-label">Your UPI Address (ID)</label>
            <input className="form-input" type="text" placeholder="example@paytm" title="UPI ID" value={upiAddress} onChange={e => setUpiAddress(e.target.value)} />
          </div>
        ) : (
          <div className="form-group-grid form-group-mt12">
            <div className="form-group">
              <label className="form-label">Bank Account Number</label>
              <input className="form-input" type="text" placeholder="Enter account no." title="Bank Account Number" value={accNo} onChange={e => setAccNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC Code</label>
              <input className="form-input text-uppercase" type="text" placeholder="e.g. SBIN0001234" title="IFSC Code" value={ifsc} onChange={e => setIfsc(e.target.value)} />
            </div>
          </div>
        )}

        <div className="modal-tip">
          Withdrawals are processed instantly on our automated system. Please ensure your details are correct.
        </div>

        <button className="btn-yellow" onClick={handleWithdraw}>Submit Withdrawal →</button>
      </div>
    </div>
  );
}

// ─── USER PROFILE & SETTINGS MODAL (PREMIUM) ─────────────────────────────────
function UserProfileModal({ onClose }: { onClose: () => void }) {
  const { user, setUser, bal, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'settings' | 'bank' | 'deposits' | 'withdraws' | 'help' | 'refer'>('settings');

  // Profile fields
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState(user?.pass || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Bank fields
  const [accNo, setAccNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [isSavingBank, setIsSavingBank] = useState(false);

  // History lists fetched from API
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdraws, setWithdraws] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const saved = localStorage.getItem(`bank_${user.email}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.accNo) setAccNo(parsed.accNo);
          if (parsed.ifsc) setIfsc(parsed.ifsc);
        } catch (e) {}
      }
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user?.name) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/history?userName=${encodeURIComponent(user.name)}`);
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
        setWithdraws(data.withdraws || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'deposits' || activeTab === 'withdraws') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return showToast('Please fill all fields', 'error');
    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: user?.name, email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('✅ Profile updated successfully!', 'success');
        if (user) {
          setUser({ ...user, email, pass: password });
        }
      } else {
        showToast(`❌ Update failed: ${data.error || 'Error'}`, 'error');
      }
    } catch (err) {
      showToast('❌ Connection error.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNo || !ifsc) return showToast('Please fill all fields', 'error');
    setIsSavingBank(true);
    if (user?.email) {
      localStorage.setItem(`bank_${user.email}`, JSON.stringify({ accNo, ifsc }));
      showToast('🏦 Bank details saved for fast withdrawal!', 'success');
      setTimeout(() => setIsSavingBank(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        
        {/* Header Section */}
        <div className="profile-header-premium">
          <div className="profile-avatar-big">
            {user?.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="profile-info-main">
            <div className="profile-name-text">{user?.name}</div>
            <div className="profile-bal-text">
              <span>💰</span> {bal.toLocaleString()} ₹
            </div>
          </div>
          <div className="modal-close-x" onClick={onClose}>×</div>
        </div>

        <div className="profile-main-layout">
          {/* Tab Navigation Sidebar */}
          <div className="profile-tabs-sidebar">
            <div className={`profile-tab-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <span className="tab-icon">⚙️</span> <span className="tab-text">Settings</span>
            </div>
            <div className={`profile-tab-item ${activeTab === 'bank' ? 'active' : ''}`} onClick={() => setActiveTab('bank')}>
              <span className="tab-icon">🏦</span> <span className="tab-text">Withdraw Details</span>
            </div>
            <div className={`profile-tab-item ${activeTab === 'deposits' ? 'active' : ''}`} onClick={() => setActiveTab('deposits')}>
              <span className="tab-icon">📥</span> <span className="tab-text">Deposit History</span>
            </div>
            <div className={`profile-tab-item ${activeTab === 'withdraws' ? 'active' : ''}`} onClick={() => setActiveTab('withdraws')}>
              <span className="tab-icon">📤</span> <span className="tab-text">Withdraw History</span>
            </div>
            <div className={`profile-tab-item ${activeTab === 'refer' ? 'active' : ''}`} onClick={() => setActiveTab('refer')}>
              <span className="tab-icon">🎁</span> <span className="tab-text">Refer & Earn</span>
            </div>
            <div className={`profile-tab-item ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>
              <span className="tab-icon">❓</span> <span className="tab-text">Help</span>
            </div>
          </div>

        {/* Content Area */}
        <div className="profile-content-area">
          
          {/* Tab 1: Settings */}
          {activeTab === 'settings' && (
            <div className="animate-fade-in">
              <div className="profile-section-title">🔐 Account Security</div>
              <form onSubmit={handleUpdateProfile}>
                <div className="form-premium-group">
                  <label className="form-premium-label">Email Address</label>
                  <input type="email" className="form-premium-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" title="Email address" required />
                </div>
                <div className="form-premium-group">
                  <label className="form-premium-label">Account Password</label>
                  <input type="text" className="form-premium-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" title="Account Password" required />
                </div>
                <button type="submit" className="btn-save-premium" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Bank Details */}
          {activeTab === 'bank' && (
            <div className="animate-fade-in">
              <div className="profile-section-title">🏦 Withdrawal Bank Details</div>
              <form onSubmit={handleSaveBank}>
                <div className="form-premium-group">
                  <label className="form-premium-label">Bank Account Number</label>
                  <input type="text" className="form-premium-input" value={accNo} onChange={e => setAccNo(e.target.value)} placeholder="Enter 12-16 digit account no." title="Bank Account Number" required />
                </div>
                <div className="form-premium-group">
                  <label className="form-premium-label">IFSC Code</label>
                  <input type="text" className="form-premium-input text-uppercase" value={ifsc} onChange={e => setIfsc(e.target.value)} placeholder="e.g. SBIN0001234" title="IFSC Code" required />
                </div>
                <button type="submit" className="btn-save-premium">
                  {isSavingBank ? '✅ Saved!' : 'Save Details'}
                </button>
              </form>
            </div>
          )}

          {/* Tab 3: Deposit History */}
          {activeTab === 'deposits' && (
            <div className="animate-fade-in">
              <div className="profile-section-title">📥 Deposit Records</div>
              {isLoadingHistory ? (
                <div className="text-muted">Loading history...</div>
              ) : deposits.length === 0 ? (
                <div className="text-muted">No deposit history found.</div>
              ) : (
                <div className="history-table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th className="history-th">Date</th>
                        <th className="history-th">Amount</th>
                        <th className="history-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((d, i) => (
                        <tr key={i} className="history-tr">
                          <td className="history-td">{new Date(d.createdAt).toLocaleDateString()}</td>
                          <td className="history-td font-bold">₹{d.amount}</td>
                          <td className="history-td">
                            <span className={`status-pill ${d.status}`}>{d.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Withdraw History */}
          {activeTab === 'withdraws' && (
            <div className="animate-fade-in">
              <div className="profile-section-title">📤 Withdrawal Records</div>
              {isLoadingHistory ? (
                <div className="text-muted">Loading history...</div>
              ) : withdraws.length === 0 ? (
                <div className="text-muted">No withdrawal history found.</div>
              ) : (
                <div className="history-table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th className="history-th">Date</th>
                        <th className="history-th">Amount</th>
                        <th className="history-th">Method</th>
                        <th className="history-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdraws.map((w, i) => (
                        <tr key={i} className="history-tr">
                          <td className="history-td">{new Date(w.createdAt).toLocaleDateString()}</td>
                          <td className="history-td font-bold">₹{w.amount}</td>
                          <td className="history-td text-muted">{w.method}</td>
                          <td className="history-td">
                            <span className="status-pill approved">Completed</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 6: Refer & Earn */}
          {activeTab === 'refer' && (
            <div className="animate-fade-in">
              <div className="profile-section-title">🎁 Refer & Earn 100 🪙</div>
              <div className="refer-card-premium">
                <p className="refer-desc">Invite your friends to AviatorX! When they register using your link, you both win. You get <strong>100 🪙</strong> instantly!</p>
                <div className="refer-link-container">
                  <input 
                    className="refer-link-input" 
                    readOnly 
                    value={`${window.location.origin}?ref=${user?.name}`} 
                    title="Your Referral Link"
                    placeholder="Referral Link"
                  />
                  <button className="btn-copy-link" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}?ref=${user?.name}`);
                    showToast('✅ Referral link copied!', 'success');
                  }}>Copy Link</button>
                </div>
                <div className="refer-stats">
                  Your Referral ID: <strong>{user?.name}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Help Section */}
          {activeTab === 'help' && (
            <div className="animate-fade-in">
              <div className="profile-section-title">❓ Help & Support</div>
              <div className="help-card">
                <div className="help-card-title">How to Withdraw?</div>
                <div className="help-card-desc">Enter your bank details in the 'Withdraw Details' tab first. Then click on your balance in the header to request a withdrawal.</div>
              </div>
              <div className="help-card">
                <div className="help-card-title">Support Email</div>
                <div className="help-card-desc">For any issues regarding deposits or account access, please email us at <strong>support@aviatorspribe.com</strong></div>
              </div>
              <div className="help-card">
                <div className="help-card-title">Fair Play</div>
                <div className="help-card-desc">All flight outcomes are generated using a provably fair system. Multipliers are determined before the round starts.</div>
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Footer with Logout */}
        <div className="profile-footer-premium">
          <button className="btn-logout-premium" onClick={() => { setUser(null); onClose(); }}>
            🚪 Log Out from Account
          </button>
        </div>

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
  const pendingCount = pendingDeposits.filter(d => d.status === 'pending').length;

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
            💰 Deposits {pendingCount > 0 && <span className="dep-badge">{pendingCount}</span>}
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
              <div className="admin-section-title">💰 Deposit Requests ({pendingCount} Pending / {pendingDeposits.length} Total)</div>
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

                <div className="admin-settings-form-group confirm-group">
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
  const [showProfileModal, setShowProfileModal] = useState(false);


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
              <span className="balance-currency">₹</span>
            </span>
            <button className="nav-deposit-btn" onClick={(e) => { e.stopPropagation(); setShowDeposit(true); }}>Deposit</button>
          </div>
          {/* Avatar / Profile modal trigger */}
          <div 
            className="nav-avatar" 
            role="button"
            tabIndex={0}
            title="Click to open Profile & Settings" 
            onClick={() => setShowProfileModal(true)}
            onKeyDown={(e) => e.key === 'Enter' && setShowProfileModal(true)}
          >
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
      {showProfileModal && <UserProfileModal onClose={() => setShowProfileModal(false)} />}
    </div>
  );
}
