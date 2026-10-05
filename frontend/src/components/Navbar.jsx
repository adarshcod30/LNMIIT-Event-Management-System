// src/components/Navbar.jsx — Responsive navigation with role-based menu
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Bell, LogOut, User, Calendar, Home, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Navbar() {
  const { user, isAuthenticated, logout, isAdmin, isFaculty, isStudent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  // Poll unread notification count every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = () => {
      api.get('/notifications/unread-count')
        .then(res => setUnreadCount(res.data.data?.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinks = isAuthenticated ? [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/events', label: 'Events', icon: Calendar },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Settings }] : []),
    ...(isFaculty ? [{ to: '/events/create', label: 'Create Event', icon: Calendar }] : []),
    ...(isStudent ? [{ to: '/event-requests/new', label: 'Request Event', icon: Calendar }] : []),
  ] : [
    { to: '/', label: 'Home', icon: Home },
    { to: '/events', label: 'Events', icon: Calendar },
  ];

  return (
    <nav style={{
      background: 'var(--color-surface)',
      boxShadow: '0 1px 0 rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.02)',
      borderBottom: '3px solid var(--color-accent)',
      position: 'sticky', top: 0, zIndex: 1000,
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          {/* Logo */}
          <Link to={isAuthenticated ? '/dashboard' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{
              width: 40, height: 40, background: 'var(--color-accent)',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: 'white',
            }}>
              L
            </div>
            <div>
              <div style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>LNMIIT</div>
              <div style={{ color: 'var(--color-accent)', fontSize: 11, letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase' }}>Event Hub</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="hidden md:flex">
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} style={{
                color: location.pathname === link.to ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.2s',
                background: location.pathname === link.to ? 'rgba(26, 35, 126, 0.05)' : 'transparent',
              }}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isAuthenticated ? (
              <>
                {/* Notification Bell */}
                <Link to="/notifications" style={{ position: 'relative', color: 'var(--color-primary)', padding: 8 }}>
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2, background: 'var(--color-error)',
                      color: 'white', borderRadius: '50%', width: 18, height: 18,
                      fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile Dropdown */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setProfileOpen(!profileOpen)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9',
                    border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text-primary)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: 'white',
                    }}>
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }} className="hidden sm:inline">{user?.name?.split(' ')[0]}</span>
                    <ChevronDown size={14} />
                  </button>

                  {profileOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 8,
                      background: 'white', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                      minWidth: 220, overflow: 'hidden', zIndex: 100,
                    }}>
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>{user?.name}</div>
                        <div style={{ fontSize: 12, color: '#5a6270' }}>{user?.email}</div>
                        <span className={`badge ${user?.role === 'admin' ? 'badge-technical' : user?.role === 'faculty' ? 'badge-academic' : 'badge-sports'}`}
                          style={{ marginTop: 6, display: 'inline-block' }}>
                          {user?.role?.toUpperCase()}
                        </span>
                      </div>
                      <Link to="/profile" onClick={() => setProfileOpen(false)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                        color: '#1a1a2e', textDecoration: 'none', fontSize: 14,
                      }}>
                        <User size={16} /> Profile
                      </Link>
                      <button onClick={handleLogout} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                        color: '#c62828', background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 14, width: '100%', textAlign: 'left',
                      }}>
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link to="/login" className="btn btn-accent btn-sm" style={{ textDecoration: 'none' }}>
                Login
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={{ background: 'var(--color-primary-dark)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px' }} className="md:hidden">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
              color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 15,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <link.icon size={18} /> {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
