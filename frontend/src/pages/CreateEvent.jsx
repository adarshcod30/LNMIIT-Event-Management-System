// src/pages/CreateEvent.jsx — Event creation form for admin/faculty
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', eventType: 'general', category: 'technical',
    venue: '', startDateTime: '', endDateTime: '', registrationDeadline: '',
    eligibility: 'all_lnmiit', maxParticipants: 0, isTeamEvent: false,
    minTeamSize: 1, maxTeamSize: 1, tags: '', club: '', rules: '',
    contactEmail: user?.email || '', contactPhone: '', isPublic: true,
  });

  const handleVenueSearch = async (val) => {
    setVenueSearch(val);
    setForm(f => ({ ...f, venue: val }));
    if (val.length >= 2) {
      try {
        const res = await api.get('/venues/search', { params: { q: val } });
        setVenueSuggestions(res.data.data || []);
      } catch { setVenueSuggestions([]); }
    } else {
      setVenueSuggestions([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const eventData = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [] };
      const res = await api.post('/events', eventData);
      toast.success('Event created successfully!');
      navigate(`/events/${res.data.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { marginBottom: 16 };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6 };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 80px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>Create <span style={{ color: 'var(--color-primary)' }}>New Event</span></h1>
      <p style={{ color: '#5a6270', marginBottom: 32 }}>Fill in the details below to create a new event. All required fields are marked.</p>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: '32px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}> Basic Information</h2>

          <div style={inputStyle}>
            <label style={labelStyle}>Event Title *</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g., Plinth Code Marathon 2026" />
          </div>

          <div style={inputStyle}>
            <label style={labelStyle}>Description *</label>
            <textarea className="input" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required placeholder="Describe your event in detail..." style={{ resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...inputStyle }}>
            <div>
              <label style={labelStyle}>Event Type *</label>
              <select className="input" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                {['coding_contest','hackathon','workshop','seminar','talk','sports','cultural','fest','club_activity','general','other'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category *</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {['technical','cultural','sports','academic','administrative','other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '32px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}> Venue & Schedule</h2>

          <div style={{ ...inputStyle, position: 'relative' }}>
            <label style={labelStyle}>Venue *</label>
            <input className="input" value={venueSearch || form.venue} onChange={e => handleVenueSearch(e.target.value)} required placeholder="Start typing venue name..." />
            {venueSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 10, maxHeight: 200, overflow: 'auto' }}>
                {venueSuggestions.map(v => (
                  <button key={v.canonical} type="button" onClick={() => { setForm(f => ({ ...f, venue: v.canonical })); setVenueSearch(v.canonical); setVenueSuggestions([]); }}
                    style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14 }}
                    onMouseOver={e => e.target.style.background = '#f5f5f5'} onMouseOut={e => e.target.style.background = 'none'}>
                    <strong>{v.canonical}</strong> <span style={{ color: '#5a6270', fontSize: 12 }}>• {v.category} {v.capacity ? `(${v.capacity} cap)` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...inputStyle }}>
            <div><label style={labelStyle}>Start Date & Time *</label><input type="datetime-local" className="input" value={form.startDateTime} onChange={e => setForm(f => ({ ...f, startDateTime: e.target.value }))} required min={new Date().toISOString().slice(0, 16)} /></div>
            <div><label style={labelStyle}>End Date & Time *</label><input type="datetime-local" className="input" value={form.endDateTime} onChange={e => setForm(f => ({ ...f, endDateTime: e.target.value }))} required min={form.startDateTime || new Date().toISOString().slice(0, 16)} /></div>
          </div>

          <div style={inputStyle}>
            <label style={labelStyle}>Registration Deadline</label>
            <input type="datetime-local" className="input" value={form.registrationDeadline} onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))} />
          </div>
        </div>

        <div className="card" style={{ padding: '32px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}> Participation</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, ...inputStyle }}>
            <div>
              <label style={labelStyle}>Eligibility *</label>
              <select className="input" value={form.eligibility} onChange={e => setForm(f => ({ ...f, eligibility: e.target.value }))}>
                <option value="all_lnmiit">All LNMIIT</option>
                <option value="students_only">Students Only</option>
                <option value="faculty_only">Faculty Only</option>
                <option value="open_to_all">Open to All</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Max Participants (0 = unlimited)</label>
              <input type="number" className="input" value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: parseInt(e.target.value) || 0 }))} min="0" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <input type="checkbox" id="isTeamEvent" checked={form.isTeamEvent} onChange={e => setForm(f => ({ ...f, isTeamEvent: e.target.checked }))} />
            <label htmlFor="isTeamEvent" style={{ fontSize: 14, fontWeight: 600 }}>This is a team event</label>
          </div>

          {form.isTeamEvent && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label style={labelStyle}>Min Team Size</label><input type="number" className="input" value={form.minTeamSize} onChange={e => setForm(f => ({ ...f, minTeamSize: parseInt(e.target.value) || 1 }))} min="1" /></div>
              <div><label style={labelStyle}>Max Team Size</label><input type="number" className="input" value={form.maxTeamSize} onChange={e => setForm(f => ({ ...f, maxTeamSize: parseInt(e.target.value) || 1 }))} min="1" /></div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '32px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}> Additional Details</h2>
          <div style={inputStyle}><label style={labelStyle}>Tags (comma-separated)</label><input className="input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="coding, hackathon, AI" /></div>
          <div style={inputStyle}><label style={labelStyle}>Club/Organization</label><input className="input" value={form.club} onChange={e => setForm(f => ({ ...f, club: e.target.value }))} placeholder="e.g., Plinth, CyberOps" /></div>
          <div style={inputStyle}><label style={labelStyle}>Rules</label><textarea className="input" rows={3} value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} placeholder="Event rules..." style={{ resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>Contact Email</label><input className="input" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></div>
            <div><label style={labelStyle}>Contact Phone</label><input className="input" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} /></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost btn-lg"><X size={18} /> Cancel</button>
          <button type="submit" disabled={submitting} className="btn btn-primary btn-lg"><Save size={18} /> {submitting ? 'Creating...' : 'Create Event'}</button>
        </div>
      </form>
    </div>
  );
}
