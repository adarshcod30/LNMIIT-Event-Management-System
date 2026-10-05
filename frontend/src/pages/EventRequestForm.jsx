// src/pages/EventRequestForm.jsx — Student event request submission
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function EventRequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', eventType: 'general', category: 'technical',
    venue: '', startDateTime: '', endDateTime: '', eligibility: 'all_lnmiit',
    maxParticipants: 0, contactEmail: user?.email || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/event-requests', { eventData: form, requestType: 'create' });
      toast.success('Event request submitted! Admin will review it.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const ls = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6 };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 80px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Request <span style={{ color: '#e65100' }}>New Event</span></h1>
      <p style={{ color: '#5a6270', marginBottom: 24 }}>Submit your event idea for admin approval. Fill in all details accurately.</p>
      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ marginBottom: 16 }}><label style={ls}>Event Title *</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
          <div style={{ marginBottom: 16 }}><label style={ls}>Description *</label><textarea className="input" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required style={{ resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={ls}>Type</label><select className="input" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>{['general','coding_contest','hackathon','workshop','seminar','cultural','sports','club_activity'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
            <div><label style={ls}>Category</label><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{['technical','cultural','sports','academic'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={ls}>Venue *</label><input className="input" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} required placeholder="e.g., LT-1, SAC, Computer Lab 2" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={ls}>Start *</label><input type="datetime-local" className="input" value={form.startDateTime} onChange={e => setForm(f => ({ ...f, startDateTime: e.target.value }))} required min={new Date().toISOString().slice(0, 16)} /></div>
            <div><label style={ls}>End *</label><input type="datetime-local" className="input" value={form.endDateTime} onChange={e => setForm(f => ({ ...f, endDateTime: e.target.value }))} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label style={ls}>Eligibility</label><select className="input" value={form.eligibility} onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))}><option value="all_lnmiit">All LNMIIT</option><option value="students_only">Students Only</option><option value="open_to_all">Open to All</option></select></div>
            <div><label style={ls}>Max Participants</label><input type="number" className="input" value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <div style={{ marginBottom: 16 }}><label style={ls}>Contact Email</label><input className="input" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost btn-lg">Cancel</button>
          <button type="submit" disabled={submitting} className="btn btn-accent btn-lg">{submitting ? 'Submitting...' : 'Submit Request'}</button>
        </div>
      </form>
    </div>
  );
}
