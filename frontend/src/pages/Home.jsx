// src/pages/Home.jsx — Public landing page with hero and event listing
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowRight, Search, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { format } from 'date-fns';

const CATEGORIES = [
  { key: 'technical', label: 'Technical', icon: '', color: '#1a237e' },
  { key: 'cultural', label: 'Cultural', icon: '', color: '#880e4f' },
  { key: 'sports', label: 'Sports', icon: '', color: '#1b5e20' },
  { key: 'academic', label: 'Academic', icon: '', color: '#0d47a1' },
];

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const params = { limit: 12 };
    if (selectedCategory) params.category = selectedCategory;
    if (search) params.search = search;
    api.get('/events', { params })
      .then(res => setEvents(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCategory, search]);

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        position: 'relative', padding: '120px 24px 100px', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-primary) 0%, #0a1142 100%)',
        overflow: 'hidden',
        borderBottom: '4px solid var(--color-accent)',
      }}>
        {/* Background Accents */}
        <div style={{ position: 'absolute', top: -150, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(198,40,40,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)' }} />

        <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }} className="animate-fade-in-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '6px 20px', borderRadius: 20, marginBottom: 24, backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Sparkles size={16} style={{ color: 'white' }} />
            <span style={{ color: 'white', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>LNMIIT Jaipur</span>
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
            The Hub for <span style={{ color: 'var(--color-accent-light)' }}>Technical</span> Excellence.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'clamp(16px, 2vw, 20px)', lineHeight: 1.6, marginBottom: 32, maxWidth: 600, margin: '0 auto 32px' }}>
            The official event management platform of The LNM Institute of Information Technology.
          </p>

          {/* Search Bar */}
          <div style={{ display: 'flex', maxWidth: 500, margin: '0 auto', background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center' }}>
              <Search size={20} style={{ color: 'var(--color-primary)' }} />
            </div>
            <input type="text" placeholder="Search events, hackathons, workshops..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#1a1a2e', fontSize: 15, padding: '14px 0' }} />
          </div>

          {/* Quick Links */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <Link to="/login" className="btn btn-accent btn-lg" style={{ textDecoration: 'none' }}>
              Get Started <ArrowRight size={18} />
            </Link>
            <Link to="/events" className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', textDecoration: 'none', padding: '14px 32px' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
              Browse Events
            </Link>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section style={{ maxWidth: 1200, margin: '-30px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setSelectedCategory(selectedCategory === cat.key ? '' : cat.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px',
                background: selectedCategory === cat.key ? cat.color : 'white',
                color: selectedCategory === cat.key ? 'white' : '#1a1a2e',
                border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                boxShadow: '0 4px 15px rgba(0,0,0,0.08)', transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 20 }}>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Events Grid */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>
            {selectedCategory ? `${CATEGORIES.find(c => c.key === selectedCategory)?.label} Events` : 'Upcoming Events'}
          </h2>
          <Link to="/events" style={{ color: '#1a237e', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            View All <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="event-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 0 }}>
                <div className="skeleton" style={{ height: 180 }} />
                <div style={{ padding: 20 }}>
                  <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#5a6270' }}>
            <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p style={{ fontSize: 16 }}>No events found. Check back later!</p>
          </div>
        ) : (
          <div className="event-grid">
            {events.map((event, idx) => (
              <Link to={`/events/${event._id}`} key={event._id}
                style={{ textDecoration: 'none', color: 'inherit', animationDelay: `${idx * 0.05}s` }}
                className="card animate-fade-in-up">
                {/* Event Banner */}
                <div style={{
                  height: 160, background: event.banner
                    ? `url(${event.banner}) center/cover`
                    : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 150%)',
                  display: 'flex', alignItems: 'flex-end', padding: 16,
                  position: 'relative', overflow: 'hidden'
                }}>
                  {/* Subtle overlay for better badge visibility */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />
                  <span style={{ position: 'relative', zIndex: 1 }} className={`badge badge-${event.category}`}>{event.category}</span>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, lineHeight: 1.3, color: '#1a1a2e' }}>
                    {event.isPinned && ' '}{event.title}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#5a6270' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={14} />
                      {event.startDateTime ? format(new Date(event.startDateTime), 'MMM dd, yyyy • h:mm a') : 'TBD'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={14} />
                      {event.canonicalVenue || event.venue || 'TBD'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} />
                      {event.registeredCount || 0}{event.maxParticipants ? `/${event.maxParticipants}` : ''} registered
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e8eaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1a237e' }}>
                        {event.organizer?.name?.[0] || 'O'}
                      </div>
                      <span style={{ fontSize: 12, color: '#5a6270' }}>{event.organizer?.name || 'Organizer'}</span>
                    </div>
                    <span className={`badge ${event.eligibility === 'open_to_all' ? 'badge-approved' : 'badge-technical'}`} style={{ fontSize: 10 }}>
                      {event.eligibility?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--color-primary)', color: 'rgba(255,255,255,0.6)', padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ fontWeight: 800, color: 'white', marginBottom: 8, fontSize: 20 }}>LNMIIT Event Hub</p>
        <p style={{ fontSize: 14 }}>The LNM Institute of Information Technology, Jaipur, Rajasthan</p>
        <p style={{ fontSize: 12, marginTop: 24, opacity: 0.5 }}>© 2026 LNMIIT. All rights reserved.</p>
      </footer>
    </div>
  );
}
