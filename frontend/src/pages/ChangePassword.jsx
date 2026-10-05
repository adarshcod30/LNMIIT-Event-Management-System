// src/pages/ChangePassword.jsx: change the admin password
// The server blocks every other admin route until the initial password has
// been replaced, so a fresh admin lands here straight after the first login.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const MIN_LENGTH = 8;

export default function ChangePassword() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const canSubmit = currentPassword && newPassword.length >= MIN_LENGTH && newPassword === confirm && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.post('/auth/admin/change-password', { currentPassword, newPassword });
      await refreshUser();
      toast.success('Password changed');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not change the password');
    } finally {
      setSaving(false);
    }
  };

  const field = (label, value, onChange, autoComplete) => (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6, display: 'block' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Lock size={18} style={{ position: 'absolute', left: 14, top: 14, color: '#b0bec5' }} />
        <input type="password" className="input" style={{ paddingLeft: 44 }} value={value}
          onChange={e => onChange(e.target.value)} autoComplete={autoComplete} required />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '48px 24px' }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={24} color="var(--color-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Change your password</h1>
        </div>
        <p style={{ fontSize: 14, color: '#5a6270', marginBottom: 24 }}>
          {user?.mustChangePassword
            ? 'This account is still using its initial password. Choose a new one to continue.'
            : 'Choose a new password for the admin account.'}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {field('Current password', currentPassword, setCurrentPassword, 'current-password')}
          {field(`New password (at least ${MIN_LENGTH} characters)`, newPassword, setNewPassword, 'new-password')}
          {tooShort && <p style={{ fontSize: 12, color: '#c62828', marginTop: -8 }}>Use at least {MIN_LENGTH} characters.</p>}
          {field('Confirm new password', confirm, setConfirm, 'new-password')}
          {mismatch && <p style={{ fontSize: 12, color: '#c62828', marginTop: -8 }}>The two passwords do not match.</p>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit}
            style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'Saving...' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
