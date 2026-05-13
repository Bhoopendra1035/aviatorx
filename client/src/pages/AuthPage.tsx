import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { BACKEND_URL } from '../store';

type Tab = 'login' | 'register';

export default function AuthPage() {
  const { setUser, setBal, socket, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('login');
  
  // Real-time fetched admin credentials
  const [adminCreds, setAdminCreds] = useState({ email: 'bhoopendratale77@gmail.com', password: 'password123' });

  const [email, setEmail] = useState('bhoopendratale77@gmail.com');
  const [pass, setPass] = useState('password123');
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');
  const [err, setErr] = useState('');

  // Load active admin credentials from DB on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/admin-credentials`)
      .then(res => res.json())
      .then(data => {
        if (data && data.email && data.password) {
          setAdminCreds(data);
          // Auto-fill login fields with updated email for convenience
          setEmail(data.email);
          setPass(data.password);
        }
      })
      .catch(err => console.error('Failed to load admin credentials:', err));
  }, []);

  const doLogin = () => {
    setErr('');
    if (!email || !pass) return setErr('Please fill all fields');
    
    // Check against live admin credentials
    const isAdmin = email.toLowerCase().trim() === adminCreds.email.toLowerCase().trim() && pass === adminCreds.password;
    const userName = isAdmin ? 'Admin' : email.split('@')[0];
    const user = { name: userName, email, isAdmin };
    socket.emit('login', { name: userName, isAdmin });
    setUser(user);
    setBal(1000);
  };

  const doRegister = () => {
    setErr('');
    if (!name || !regEmail || !regPass) return setErr('Please fill all fields');
    if (regPass !== regPass2) return setErr('Passwords do not match');
    if (regPass.length < 6) return setErr('Password must be at least 6 characters');
    socket.emit('login', { name, isAdmin: false });
    setUser({ name, email: regEmail, isAdmin: false });
    setBal(1000);
    showToast(`Welcome to Aviator, ${name}! 🎉 You got 1,000 🪙 free demo coins!`, 'success');
  };

  return (
    <div className="auth-page">
      <div className="auth-box animate-fade-in">
        <div className="auth-logo-row">
          {/* Brand Logo & Name */}
          <svg className="auth-logo-img" viewBox="0 0 100 100" width="50" height="50" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 80 L35 45 L70 45 L85 55 L75 60 L60 52 L35 52 L25 80 Z" fill="#e11d48"/>
            <path d="M35 45 L50 20 L60 20 L52 45 Z" fill="#be123c"/>
            <circle cx="28" cy="48" r="4" fill="#fff"/>
            <rect x="73" y="55" width="10" height="2" transform="rotate(25 73 55)" fill="#fff" />
          </svg>
          <div className="auth-brand-name">Aviator<span>Spribe</span></div>
          <div className="auth-subtitle">Server Authoritative Crash Game</div>
        </div>

        <div className="auth-tabs">
          <div className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setErr(''); }}>Sign In</div>
          <div className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setErr(''); }}>Register</div>
        </div>

        {err && <div className="auth-error">⚠️ {err}</div>}

        {tab === 'login' ? (
          <>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doLogin()} />
            </div>
            <button className="btn-yellow" onClick={doLogin}>Sign In →</button>
            
            <div className="auth-divider">or</div>
            
            <button className="btn-outline" onClick={() => {
              socket.emit('login', { name: 'Guest Player', isAdmin: false });
              setUser({ name: 'Guest Player', email: 'guest@demo.com', isAdmin: false });
              setBal(500);
            }}> Play as Guest (Get 500 🪙)</button>
            
            <div className="auth-demo-tip">
              Demo admin: <strong className="yellow-text">{adminCreds.email}</strong> / <strong className="yellow-text">{adminCreds.password}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" type="text" placeholder="Arjun Sharma" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min 6 characters" value={regPass} onChange={e => setRegPass(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={regPass2} onChange={e => setRegPass2(e.target.value)} />
            </div>
            <button className="btn-yellow" onClick={doRegister}>Create Account & Get 1000 🪙</button>
          </>
        )}

        <div className="auth-switch">
          {tab === 'login' ? <>New here? <span onClick={() => setTab('register')}>Register Free</span></> : <>Have account? <span onClick={() => setTab('login')}>Sign In</span></>}
        </div>
      </div>
    </div>
  );
}
