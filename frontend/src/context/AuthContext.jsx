// src/context/AuthContext.jsx — Authentication Context Provider
// Manages user state, login/logout, and token storage
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only wait for /auth/me when there is a token to check
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));

  // Check for existing session on app load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data.data.user))
        .catch(() => { localStorage.clear(); })
        .finally(() => setLoading(false));
    }
  }, []);

  // Demo login (for development without Google OAuth)
  const demoLogin = useCallback(async (email) => {
    const res = await api.post('/auth/demo-login', { email });
    const { user: userData, accessToken, refreshToken } = res.data.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    return userData;
  }, []);

  // Admin login with email/password
  const adminLogin = useCallback(async (email, password) => {
    const res = await api.post('/auth/admin/login', { email, password });
    const { user: userData, accessToken, refreshToken } = res.data.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    return userData;
  }, []);

  // Handle Google OAuth callback
  const handleOAuthCallback = useCallback((token, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    return api.get('/auth/me').then(res => {
      setUser(res.data.data.user);
      return res.data.data.user;
    });
  }, []);

  // Reload the signed-in user, for example after a password change clears mustChangePassword
  const refreshUser = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* logging out locally is enough */ }
    localStorage.clear();
    setUser(null);
  }, []);

  const value = {
    user, loading, demoLogin, adminLogin, handleOAuthCallback, refreshUser, logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isFaculty: user?.role === 'faculty',
    isStudent: user?.role === 'student',
    isOutsider: user?.role === 'outsider',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
