// src/pages/Dashboard.jsx — "Me" Dashboard with role-specific views
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Clock, FileText, Plus, ChevronRight, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, isAdmin, isFaculty, isStudent, isOutsider } = useAuth();
  const [myEvents, setMyEvents] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const promises = [];
        // Registrations for all roles
        promises.push(api.get('/registrations/my').then(r => setMyRegistrations(r.data.data || [])).catch(() => {}));
        // Teams for students
        if (isStudent || isFaculty) {
          promises.push(api.get('/teams/my').then(r => setMyTeams(r.data.data || [])).catch(() => {}));
        }
        // Event requests for students
        if (isStudent) {
          promises.push(api.get('/event-requests/my').then(r => setMyRequests(r.data.data || [])).catch(() => {}));
        }
        // Events for faculty/admin
        if (isFaculty || isAdmin) {
          promises.push(api.get('/events', { params: { organizer: user._id, limit: 50 } }).then(r => setMyEvents(r.data.data || [])).catch(() => {}));
        }
        // Admin dashboard stats
        if (isAdmin) {
          promises.push(api.get('/admin/dashboard').then(r => setAdminStats(r.data.data)).catch(() => {}));
        }
        await Promise.all(promises);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const upcomingRegs = myRegistrations.filter(r => r.event && new Date(r.event.startDateTime) > new Date() && r.status === 'registered');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      {/* Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
            Hello, <span style={{ color: 'var(--color-primary)' }}>{user?.name?.split(' ')[0]}</span> <span style={{ color: 'var(--color-accent)' }}>.</span>
          </h1>
          <p style={{ color: '#5a6270', marginTop: 4 }}>
            {isAdmin && 'System Administrator Dashboard'}
            {isFaculty && 'Faculty Dashboard — Manage your events'}
            {isStudent && 'Student Dashboard — Your events and registrations'}
            {isOutsider && 'Welcome! Browse public events and register'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(isAdmin || isFaculty) && (
            <Link to="/events/create" className="btn btn-primary">
              <Plus size={18} /> Create Event
            </Link>
          )}
          {isStudent && (
            <Link to="/event-requests/new" className="btn btn-accent">
              <FileText size={18} /> Request Event
            </Link>
          )}
        </div>
      </div>

      {/* Admin Stats Cards */}
      {isAdmin && adminStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Users', value: adminStats.stats?.totalUsers, icon: Users, color: 'var(--color-primary)', bg: '#f1f5f9' },
            { label: 'Total Events', value: adminStats.stats?.totalEvents, icon: Calendar, color: 'var(--color-text-secondary)', bg: '#f1f5f9' },
            { label: 'Registrations', value: adminStats.stats?.totalRegistrations, icon: BookOpen, color: 'var(--color-text-secondary)', bg: '#f1f5f9' },
            { label: 'Pending Requests', value: adminStats.stats?.pendingRequests, icon: Clock, color: 'var(--color-warning)', bg: '#fffbeb' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{stat.value || 0}</div>
                <div style={{ fontSize: 13, color: '#5a6270' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Quick Actions */}
      {isAdmin && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/admin" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>Admin Panel</Link>
            <Link to="/admin/requests" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
              Review Requests {adminStats?.stats?.pendingRequests > 0 && `(${adminStats.stats.pendingRequests})`}
            </Link>
            <Link to="/admin/users" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>Manage Users</Link>
            <Link to="/admin/analytics" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>Analytics</Link>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* My Upcoming Events */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
              {isFaculty || isAdmin ? 'My Events' : 'Upcoming Events'}
            </h3>
            <Link to="/events" style={{ fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none' }}>View All</Link>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60 }} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(isFaculty || isAdmin ? myEvents : upcomingRegs.map(r => r.event)).slice(0, 5).map(event => event && (
                <Link to={`/events/${event._id}`} key={event._id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: '#f8f9fa', borderRadius: 10, textDecoration: 'none', color: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#e8eaf6'}
                onMouseOut={e => e.currentTarget.style.background = '#f8f9fa'}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 12, 
                    background: 'var(--color-surface-dark)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    flexShrink: 0, border: '1px solid var(--color-border)',
                    color: 'var(--color-primary)'
                  }}>
                    <Calendar size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
                    <div style={{ fontSize: 12, color: '#5a6270' }}>
                      {event.startDateTime ? format(new Date(event.startDateTime), 'MMM dd, h:mm a') : 'TBD'} • {event.canonicalVenue || 'TBD'}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: '#b0bec5' }} />
                </Link>
              ))}
              {(isFaculty || isAdmin ? myEvents : upcomingRegs).length === 0 && (
                <p style={{ textAlign: 'center', color: '#5a6270', padding: 20, fontSize: 14 }}>No upcoming events</p>
              )}
            </div>
          )}
        </div>

        {/* My Registrations / Teams */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} style={{ color: 'var(--color-text-secondary)' }} />
              {isStudent ? 'My Teams' : 'Recent Registrations'}
            </h3>
          </div>
          {isStudent && myTeams.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myTeams.slice(0, 5).map(team => (
                <div key={team._id} style={{ padding: '12px 16px', background: '#f8f9fa', borderRadius: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{team.name}</div>
                  <div style={{ fontSize: 12, color: '#5a6270', marginTop: 4 }}>
                    {team.event?.title || 'Event'} • {team.members?.length || 0} members
                  </div>
                  <span className={`badge badge-${team.status === 'complete' ? 'approved' : 'pending'}`} style={{ marginTop: 6 }}>
                    {team.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myRegistrations.slice(0, 5).map(reg => reg.event && (
                <div key={reg._id} style={{ padding: '12px 16px', background: '#f8f9fa', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{reg.event?.title}</div>
                    <div style={{ fontSize: 12, color: '#5a6270' }}>{reg.event?.startDateTime ? format(new Date(reg.event.startDateTime), 'MMM dd') : ''}</div>
                  </div>
                  <span className={`badge badge-${reg.status === 'registered' ? 'approved' : reg.status === 'waitlisted' ? 'pending' : 'cancelled'}`}>
                    {reg.status}
                  </span>
                </div>
              ))}
              {myRegistrations.length === 0 && (
                <p style={{ textAlign: 'center', color: '#5a6270', padding: 20, fontSize: 14 }}>No registrations yet</p>
              )}
            </div>
          )}
        </div>

        {/* Student Event Requests */}
        {isStudent && (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} style={{ color: 'var(--color-warning)' }} />
                My Requests
              </h3>
              <Link to="/event-requests/new" style={{ fontSize: 13, color: 'var(--color-warning)', textDecoration: 'none' }}>New Request</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myRequests.slice(0, 5).map(req => (
                <div key={req._id} style={{ padding: '12px 16px', background: '#f8f9fa', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{req.eventData?.title}</div>
                    <div style={{ fontSize: 12, color: '#5a6270' }}>{req.requestType} request</div>
                  </div>
                  <span className={`badge badge-${req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'rejected' : 'pending'}`}>
                    {req.status}
                  </span>
                </div>
              ))}
              {myRequests.length === 0 && (
                <p style={{ textAlign: 'center', color: '#5a6270', padding: 20, fontSize: 14 }}>No requests submitted</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
