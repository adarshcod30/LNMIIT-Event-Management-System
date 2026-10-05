// src/pages/Login.jsx — Login page with demo login and admin login
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DEMO_USERS = [
  { label: 'Faculty', email: 'vikas.bajpai@lnmiit.ac.in', color: '#0d47a1', icon: '‍' },
  { label: 'Student', email: '23ucs509@lnmiit.ac.in', color: '#2e7d32', icon: '' },
  { label: 'Outsider', email: 'john.smith@gmail.com', color: '#e65100', icon: '' },
];

export default function Login() {
  const { demoLogin, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('demo'); // 'demo' | 'admin' | 'google'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = async (demoEmail) => {
    setLoading(true);
    try {
      const user = await demoLogin(demoEmail);
      toast.success(`Welcome, ${user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      // The server only offers quick login when ENABLE_DEMO_LOGIN=true outside production
      if (err.response?.status === 404) toast.error('Quick login is switched off on this server. Use Google sign-in.');
      else toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await adminLogin(email, password);
      toast.success(`Welcome, ${user.name}!`);
      if (user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'white' }}>
      {/* Left Panel — Branding */}
      <div style={{ 
          flex: 1, background: 'var(--color-primary)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 48, position: 'relative',
          overflow: 'hidden',
        }} className="hidden md:flex">
          <div style={{ position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: '50%', background: 'rgba(198, 40, 40, 0.1)' }} />
          <div style={{ position: 'absolute', bottom: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          
          <div style={{
            width: 80, height: 80, background: 'var(--color-accent)', borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            fontSize: 40, fontWeight: 900, marginBottom: 24, position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            L
          </div>
          <h2 style={{ color: 'white', fontSize: 32, fontWeight: 900, marginBottom: 16 }}>LNMIIT <span style={{ color: 'var(--color-accent)' }}>Hub</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
            Access the centralized technical event management portal of LNMIIT.
          </p>
      </div>

      {/* Right Panel — Login Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card animate-fade-in-up" style={{ width: '100%', maxWidth: 440, padding: '40px 36px' }}>
          {/* LNMIIT Logo area */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>
              Welcome <span style={{ color: 'var(--color-primary)' }}>Back</span>
            </h2>
            <p style={{ color: '#5a6270', fontSize: 14, marginTop: 4 }}>Sign in to continue to your dashboard</p>
          </div>

          {/* Mode Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f5f5f5', borderRadius: 10, padding: 4 }}>
            {[
              { key: 'demo', label: 'Quick Login' },
              { key: 'admin', label: 'Admin Login' },
              { key: 'google', label: 'Google OAuth' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setMode(tab.key)} style={{
                flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: mode === tab.key ? 'white' : 'transparent',
                color: mode === tab.key ? '#1a237e' : '#5a6270',
                boxShadow: mode === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Demo Login */}
          {mode === 'demo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#5a6270', marginBottom: 4 }}>Select a role to log in instantly (uses seed data). The admin signs in under Admin Login:</p>
              {DEMO_USERS.map(u => (
                <button key={u.email} onClick={() => handleDemoLogin(u.email)} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                    background: 'white', border: '2px solid #e0e0e0', borderRadius: 12,
                    cursor: 'pointer', transition: 'all 0.2s', fontSize: 14, textAlign: 'left',
                  }}
                  onMouseOver={e => { e.target.style.borderColor = u.color; e.target.style.background = `${u.color}08`; }}
                  onMouseOut={e => { e.target.style.borderColor = '#e0e0e0'; e.target.style.background = 'white'; }}>
                  <span style={{ fontSize: 22 }}>{u.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{u.label}</div>
                    <div style={{ fontSize: 12, color: '#5a6270' }}>{u.email}</div>
                  </div>
                  <ArrowRight size={16} style={{ color: '#b0bec5' }} />
                </button>
              ))}
            </div>
          )}

          {/* Admin Login */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6, display: 'block' }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#b0bec5' }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="admin@lnmiit.ac.in" className="input" style={{ paddingLeft: 44 }} required />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6, display: 'block' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#b0bec5' }} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password" className="input" style={{ paddingLeft: 44 }} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
                style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Signing in...' : 'Sign In'} <LogIn size={18} />
              </button>
            </form>
          )}

          {/* Google OAuth */}
          {mode === 'google' && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#5a6270', marginBottom: 20 }}>
                Use your LNMIIT institutional Google account to sign in. Your role will be automatically determined from your email.
              </p>
              <button onClick={handleGoogleLogin} className="btn btn-lg" style={{
                width: '100%', justifyContent: 'center', background: 'white',
                border: '2px solid #e0e0e0', color: '#1a1a2e',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/></svg>
                Sign in with Google
              </button>
              <div style={{ marginTop: 20, padding: 16, background: '#e8eaf6', borderRadius: 10, textAlign: 'left' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#1a237e', marginBottom: 6 }}>Role Assignment:</p>
                <ul style={{ fontSize: 12, color: '#5a6270', paddingLeft: 16, lineHeight: 1.8 }}>
                  <li><strong>Students:</strong> 23ucs509@lnmiit.ac.in pattern</li>
                  <li><strong>Faculty:</strong> vikas.bajpai@lnmiit.ac.in pattern</li>
                  <li><strong>External:</strong> Any non-LNMIIT email</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
