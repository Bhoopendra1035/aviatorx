import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { BACKEND_URL } from '../store';

type Tab = 'login' | 'register';

export default function AuthPage() {
  const { setUser, setBal, socket, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('login');
  
  // Real-time fetched admin credentials
  const [adminCreds, setAdminCreds] = useState({ email: 'bhoopendratale8@gmail.com', password: 'password123' });

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');
  const [err, setErr] = useState('');

  // Password toggles
  const [showPass, setShowPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  // Refs for auto-saving login password securely
  const passRef = React.useRef('');
  const regPassRef = React.useRef('');
  useEffect(() => { passRef.current = pass; }, [pass]);
  useEffect(() => { regPassRef.current = regPass; }, [regPass]);

  // Email format verification helper
  const validateEmail = (emailStr: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  // Load active admin credentials from DB on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/admin-credentials`)
      .then(res => res.json())
      .then(data => {
        if (data && data.email && data.password) {
          setAdminCreds(data);
        }
      })
      .catch(err => console.error('Failed to load admin credentials:', err));
  }, []);

  // Listen for socket auth callbacks
  useEffect(() => {
    const handleLoginSuccess = (data: any) => {
      const actualPass = tab === 'login' ? passRef.current : regPassRef.current;
      setUser({ name: data.name, email: data.email, isAdmin: data.isAdmin, pass: actualPass });
      setBal(data.bal);
      if (tab === 'register') {
        showToast(`Welcome to Aviator, ${data.name}! 🎉 Registration successful!`, 'success');
      } else {
        showToast(`Welcome back, ${data.name}! 👋`, 'success');
      }
    };

    const handleLoginError = (data: any) => {
      setErr(data.msg || 'Authentication failed');
      showToast(`❌ Error: ${data.msg || 'Authentication failed'}`, 'error');
    };

    const handleCredsUpdate = (data: any) => {
      if (data && data.email && data.password) {
        setAdminCreds(data);
        // Sync active login input fields with the newly changed credentials
        setEmail(data.email);
        setPass(data.password);
        showToast('🔐 Live admin credentials changed! Local cache synchronized in real-time.', 'info');
      }
    };

    socket.on('loginSuccess', handleLoginSuccess);
    socket.on('loginError', handleLoginError);
    socket.on('adminCredentialsUpdated', handleCredsUpdate);

    return () => {
      socket.off('loginSuccess', handleLoginSuccess);
      socket.off('loginError', handleLoginError);
      socket.off('adminCredentialsUpdated', handleCredsUpdate);
    };
  }, [socket, setUser, setBal, tab, showToast]);

  const doLogin = () => {
    setErr('');
    if (!email || !pass) return setErr('Please fill all fields');
    if (!validateEmail(email)) {
      setErr('⚠️ ईमेल का फॉर्मेट गलत है! कृपया सही ईमेल डालें (उदा: you@example.com)');
      return;
    }
    
    socket.emit('login', { action: 'login', email, pass });
  };

  const doRegister = () => {
    setErr('');
    if (!name || !regEmail || !regPass) return setErr('Please fill all fields');
    if (!validateEmail(regEmail)) {
      setErr('⚠️ ईमेल का फॉर्मेट गलत है! कृपया सही ईमेल डालें (उदा: you@example.com)');
      return;
    }
    if (regPass !== regPass2) return setErr('Passwords do not match');
    if (regPass.length < 6) return setErr('Password must be at least 6 characters');
    
    const uName = name.trim();
    socket.emit('login', { action: 'register', name: uName, email: regEmail, pass: regPass });
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

        {err && <div className="auth-error">{err}</div>}

        {tab === 'login' ? (
          <>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-input-wrapper">
                <input className="form-input password-input-with-toggle" type={showPass ? "text" : "password"} placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowPass(!showPass)}>
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button className="btn-yellow" onClick={doLogin}>Sign In →</button>
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
              <div className="password-input-wrapper">
                <input className="form-input password-input-with-toggle" type={showRegPass ? "text" : "password"} placeholder="Min 6 characters" value={regPass} onChange={e => setRegPass(e.target.value)} />
                <button type="button" className="password-toggle-btn" onClick={() => setShowRegPass(!showRegPass)}>
                  {showRegPass ? "Hide" : "Show"}
                </button>
              </div>
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
