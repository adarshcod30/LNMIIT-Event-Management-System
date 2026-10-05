// src/pages/Events.jsx — Event listing page with filters
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Users, Search, Grid, List } from 'lucide-react';
import api from '../api/axios';
import { format } from 'date-fns';

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('grid');

  const filters = {
    category: searchParams.get('category') || '',
    eventType: searchParams.get('eventType') || '',
    search: searchParams.get('search') || '',
  };

  // The list remembers which query it belongs to; "loading" is "the list on
  // screen is for an older query", so the effect never sets state synchronously.
  const queryKey = searchParams.toString();
  const [result, setResult] = useState({ key: null, events: [], pagination: {} });
  const loading = result.key !== queryKey;
  const { events, pagination } = result;

  useEffect(() => {
    let cancelled = false;
    const params = { limit: 12, page: parseInt(searchParams.get('page')) || 1 };
    for (const key of ['category', 'eventType', 'search']) {
      if (searchParams.get(key)) params[key] = searchParams.get(key);
    }

    api.get('/events', { params })
      .then(res => { if (!cancelled) setResult({ key: queryKey, events: res.data.data || [], pagination: res.data.pagination || {} }); })
      .catch(() => { if (!cancelled) setResult({ key: queryKey, events: [], pagination: {} }); });
    return () => { cancelled = true; };
  }, [searchParams, queryKey]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)' }}>
          Available <span style={{ color: 'var(--color-primary)' }}>Events</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('grid')} className={`btn btn-sm ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`}><Grid size={16} /></button>
          <button onClick={() => setView('list')} className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`}><List size={16} /></button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#b0bec5' }} />
          <input type="text" placeholder="Search events..." className="input" style={{ paddingLeft: 36, padding: '10px 12px 10px 36px' }}
            value={filters.search} onChange={e => updateFilter('search', e.target.value)} />
        </div>
        <select className="input" style={{ flex: '0 1 160px' }} value={filters.category} onChange={e => updateFilter('category', e.target.value)}>
          <option value="">All Categories</option>
          <option value="technical">Technical</option>
          <option value="cultural">Cultural</option>
          <option value="sports">Sports</option>
          <option value="academic">Academic</option>
        </select>
        <select className="input" style={{ flex: '0 1 160px' }} value={filters.eventType} onChange={e => updateFilter('eventType', e.target.value)}>
          <option value="">All Types</option>
          <option value="hackathon">Hackathon</option>
          <option value="workshop">Workshop</option>
          <option value="coding_contest">Coding Contest</option>
          <option value="seminar">Seminar</option>
          <option value="talk">Talk</option>
          <option value="sports">Sports</option>
          <option value="cultural">Cultural</option>
        </select>
      </div>

      {/* Events */}
      {loading ? (
        <div className="event-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card"><div className="skeleton" style={{height:160}}/><div style={{padding:16}}><div className="skeleton" style={{height:20,marginBottom:8}}/><div className="skeleton" style={{height:14,width:'60%'}}/></div></div>)}
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Calendar size={48} style={{ margin: '0 auto 16px', color: '#b0bec5' }} />
          <h3>No events found</h3>
          <p style={{ color: '#5a6270' }}>Try adjusting your filters</p>
        </div>
      ) : view === 'grid' ? (
        <div className="event-grid">
          {events.map((event) => (
            <Link to={`/events/${event._id}`} key={event._id} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                height: 140, background: event.banner ? `url(${event.banner}) center/cover` : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 150%)',
                display: 'flex', alignItems: 'flex-end', padding: 16, position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />
                <span style={{ position: 'relative', zIndex: 1 }} className={`badge badge-${event.category}`}>{event.category}</span>
              </div>
              <div style={{ padding: '14px 18px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{event.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#5a6270' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} />{event.startDateTime ? format(new Date(event.startDateTime), 'MMM dd, yyyy') : 'TBD'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} />{event.canonicalVenue || 'TBD'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={13} />{event.registeredCount || 0}{event.maxParticipants ? `/${event.maxParticipants}` : ''}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-dark)' }}>
                {['Event', 'Category', 'Date', 'Venue', 'Registrations', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{event.title}</td>
                  <td style={{ padding: '14px 16px' }}><span className={`badge badge-${event.category}`}>{event.category}</span></td>
                  <td style={{ padding: '14px 16px', color: '#5a6270' }}>{event.startDateTime ? format(new Date(event.startDateTime), 'MMM dd, yyyy') : 'TBD'}</td>
                  <td style={{ padding: '14px 16px', color: '#5a6270' }}>{event.canonicalVenue || 'TBD'}</td>
                  <td style={{ padding: '14px 16px' }}>{event.registeredCount || 0}{event.maxParticipants ? `/${event.maxParticipants}` : ''}</td>
                  <td style={{ padding: '14px 16px' }}><Link to={`/events/${event._id}`} className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => updateFilter('page', p)} className={`btn btn-sm ${p === pagination.page ? 'btn-primary' : 'btn-ghost'}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
