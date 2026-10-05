// src/pages/EventDetail.jsx — Full event detail page with registration
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Clock, Download, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { format } from 'date-fns';
import toast from 'react-hot-toast';


export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myReg, setMyReg] = useState(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.data)).catch(() => navigate('/events')).finally(() => setLoading(false));
    if (isAuthenticated) {
      api.get('/registrations/my').then(res => {
        const reg = res.data.data?.find(r => r.event?._id === id || r.event === id);
        setMyReg(reg);
      }).catch(() => {});
    }
  }, [id, isAuthenticated]);

  const handleRegister = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setRegistering(true);
    try {
      const res = await api.post('/registrations', { eventId: id });
      setMyReg(res.data.data);
      toast.success(res.data.message || 'Registered!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancel = async () => {
    if (!myReg) return;
    try {
      await api.patch(`/registrations/${myReg._id}/cancel`);
      setMyReg(null);
      toast.success('Registration cancelled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const handleDownloadICS = () => { window.open(`${import.meta.env.VITE_API_URL}/events/${id}/ics`, '_blank'); };

  if (loading) return <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}><div className="skeleton" style={{ height: 300, borderRadius: 16 }} /><div className="skeleton" style={{ height: 40, marginTop: 20, width: '60%' }} /></div>;
  if (!event) return null;

  const canRegister = event.status === 'approved' && (!event.registrationDeadline || new Date() < new Date(event.registrationDeadline));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' }}>
      <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ marginBottom: 16 }}><ArrowLeft size={18} /> Back</button>

      {/* Banner */}
      <div style={{
        height: 280, borderRadius: 20, overflow: 'hidden',
        background: event.banner ? `url(${event.banner}) center/cover` : 'var(--color-primary)',
        display: 'flex', alignItems: 'flex-end', padding: 24,
      }}>
        <div className="glass" style={{ padding: '16px 24px', borderRadius: 12 }}>
          <span className={`badge badge-${event.category}`} style={{ marginBottom: 8, display: 'inline-block' }}>{event.category}</span>
          <h1 style={{ color: 'white', fontSize: 28, fontWeight: 800 }}>{event.title}</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, marginTop: 24 }} className="event-detail-grid">
        {/* Main Content */}
        <div>
          <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>About This Event</h2>
            <p style={{ color: '#424242', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.description}</p>
          </div>

          {event.rules && (
            <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}> Rules</h2>
              <div style={{ color: '#424242', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{event.rules}</div>
            </div>
          )}

          {event.rounds?.length > 0 && (
            <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}> Rounds</h2>
              {event.rounds.map((round, i) => (
                <div key={i} style={{ padding: '12px 16px', background: '#f8f9fa', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{round.roundName}</div>
                  <div style={{ fontSize: 13, color: '#5a6270' }}>
                    {round.canonicalVenue || round.roundVenue || 'TBD'} • {round.roundStartDateTime ? format(new Date(round.roundStartDateTime), 'MMM dd, h:mm a') : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {event.prizes?.length > 0 && (
            <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}> Prizes</h2>
              {event.prizes.map((prize, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < event.prizes.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <span style={{ fontWeight: 600 }}>{prize.position}</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{prize.prize}{prize.amount ? ` — ₹${prize.amount.toLocaleString()}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {event.faqs?.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}> FAQs</h2>
              {event.faqs.map((faq, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Q: {faq.question}</div>
                  <div style={{ color: '#5a6270' }}>A: {faq.answer}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Calendar size={18} style={{ color: 'var(--color-primary)' }} /><div><div style={{ fontWeight: 600 }}>Date & Time</div><div style={{ color: '#5a6270', fontSize: 13 }}>{event.startDateTime ? format(new Date(event.startDateTime), 'EEEE, MMMM dd, yyyy') : 'TBD'}<br/>{event.startDateTime ? format(new Date(event.startDateTime), 'h:mm a') : ''} - {event.endDateTime ? format(new Date(event.endDateTime), 'h:mm a') : ''}</div></div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><MapPin size={18} style={{ color: 'var(--color-text-secondary)' }} /><div><div style={{ fontWeight: 600 }}>Venue</div><div style={{ color: '#5a6270', fontSize: 13 }}>{event.canonicalVenue || event.venue || 'TBD'}</div></div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Users size={18} style={{ color: 'var(--color-text-secondary)' }} /><div><div style={{ fontWeight: 600 }}>Participants</div><div style={{ color: '#5a6270', fontSize: 13 }}>{event.registeredCount || 0}{event.maxParticipants ? ` / ${event.maxParticipants}` : ' registered'}</div></div></div>
              {event.isTeamEvent && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Users size={18} style={{ color: 'var(--color-text-secondary)' }} /><div><div style={{ fontWeight: 600 }}>Team Size</div><div style={{ color: '#5a6270', fontSize: 13 }}>{event.minTeamSize} - {event.maxTeamSize} members</div></div></div>}
              {event.registrationDeadline && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Clock size={18} style={{ color: 'var(--color-warning)' }} /><div><div style={{ fontWeight: 600 }}>Deadline</div><div style={{ color: '#5a6270', fontSize: 13 }}>{format(new Date(event.registrationDeadline), 'MMM dd, yyyy h:mm a')}</div></div></div>}
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 20, paddingTop: 20 }}>
              {myReg ? (
                <div>
                  <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: 10, marginBottom: 12, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                    <div style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 14 }}> {myReg.status === 'waitlisted' ? 'On Waitlist' : 'Registered'}</div>
                  </div>
                  {myReg.checkInCode && (
                    <div style={{ textAlign: 'center', marginBottom: 12, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, fontWeight: 600 }}>CHECK-IN CODE</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace', letterSpacing: 1.5, wordBreak: 'break-all' }}>{myReg.checkInCode.substring(0, 8).toUpperCase()}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>Show this to the organizer at check-in</div>
                    </div>
                  )}
                  {myReg.status !== 'cancelled' && canRegister && (
                    <button onClick={handleCancel} className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'center' }}>Cancel Registration</button>
                  )}
                </div>
              ) : canRegister ? (
                <button onClick={handleRegister} disabled={registering} className="btn btn-accent btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                  {registering ? 'Registering...' : 'Register Now'}
                </button>
              ) : (
                <div style={{ background: '#eceff1', padding: '12px 16px', borderRadius: 10, textAlign: 'center', color: '#546e7a', fontWeight: 600 }}>
                  Registration Closed
                </div>
              )}
            </div>
          </div>

          {/* Organizer */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Organizer</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1a237e' }}>
                {event.organizer?.name?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{event.organizer?.name}</div>
                <div style={{ fontSize: 12, color: '#5a6270' }}>{event.organizer?.role} {event.organizer?.department ? `• ${event.organizer.department}` : ''}</div>
              </div>
            </div>
            {event.contactEmail && <div style={{ marginTop: 12, fontSize: 13, color: '#5a6270' }}> {event.contactEmail}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleDownloadICS} className="btn btn-outline btn-sm" style={{ flex: 1 }}><Download size={14} /> Calendar</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .event-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
