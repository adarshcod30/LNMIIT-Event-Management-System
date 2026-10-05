// src/pages/AuthCallback.jsx — Handles Google OAuth callback
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleOAuthCallback } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      toast.error('Authentication failed. Please try again.');
      navigate('/login');
      return;
    }

    if (token && refreshToken) {
      handleOAuthCallback(token, refreshToken)
        .then(user => {
          toast.success(`Welcome, ${user.name}!`);
          navigate('/dashboard');
        })
        .catch(() => {
          toast.error('Failed to complete authentication.');
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px' }} />
        <p style={{ color: '#5a6270' }}>Completing authentication...</p>
      </div>
    </div>
  );
}
