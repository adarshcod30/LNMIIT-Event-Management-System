// src/pages/Profile.jsx — User profile page
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', bio: user?.bio || '',
    department: user?.department || '', rollNumber: user?.rollNumber || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/profile', form);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const ls = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6 };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>My <span style={{ color: '#1a237e' }}>Profile</span></h1>
      <div className="card" style={{ padding: '32px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '2px solid #f0f0f0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'white' }}>
            {user?.name?.[0]}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ color: '#5a6270', fontSize: 14 }}>{user?.email}</div>
            <span className={`badge badge-${user?.role === 'admin' ? 'technical' : 'approved'}`} style={{ marginTop: 4 }}>{user?.role?.toUpperCase()}</span>
          </div>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}><label style={ls}>Full Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={ls}>Department</label><select className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}><option value="">Select</option>{['CSE','ECE','EE','MME','Physics','Mathematics','HSS','Other'].map(d=><option key={d} value={d}>{d}</option>)}</select></div>
            <div><label style={ls}>Roll Number</label><input className="input" value={form.rollNumber} onChange={e => setForm(f => ({ ...f, rollNumber: e.target.value }))} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={ls}>Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div style={{ marginBottom: 16 }}><label style={ls}>Bio</label><textarea className="input" rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} style={{ resize: 'vertical' }} /></div>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>{saving ? 'Saving...' : 'Save Profile'}</button>
        </form>
      </div>
    </div>
  );
}
