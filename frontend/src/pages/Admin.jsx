// src/pages/Admin.jsx — Admin dashboard panel
import { useState, useEffect } from 'react';
import { Link, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Users, Calendar, FileText, Shield, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#1a237e', '#c62828', '#2563eb', '#dc2626', '#1e3a8a', '#991b1b'];

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/admin/dashboard').then(r => setStats(r.data.data)).catch(() => {}); }, []);
  if (!stats) return <div className="skeleton" style={{ height: 200 }} />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Users', value: stats.stats?.totalUsers, icon: Users, color: 'var(--color-primary)', bg: '#f1f5f9' },
          { label: 'Events', value: stats.stats?.totalEvents, icon: Calendar, color: 'var(--color-text-secondary)', bg: '#f1f5f9' },
          { label: 'Registrations', value: stats.stats?.totalRegistrations, icon: FileText, color: 'var(--color-text-secondary)', bg: '#f1f5f9' },
          { label: 'Pending', value: stats.stats?.pendingRequests, icon: Shield, color: 'var(--color-warning)', bg: '#fffbeb' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.icon size={20} style={{ color: s.color }} /></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{s.value || 0}</div><div style={{ fontSize: 12, color: '#5a6270' }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Users by Role</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={Object.entries(stats.usersByRole || {}).map(([name, value]) => ({ name, value }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {Object.keys(stats.usersByRole || {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Upcoming Events</h3>
          {stats.upcomingEvents?.slice(0, 5).map(e => (
            <Link key={e._id} to={`/events/${e._id}`} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid #f0f0f0', textDecoration: 'none', color: '#1a1a2e', fontSize: 14 }}>
              <strong>{e.title}</strong>
              <div style={{ fontSize: 12, color: '#5a6270' }}>{e.startDateTime ? format(new Date(e.startDateTime), 'MMM dd') : ''} • {e.organizer?.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [search, setSearch] = useState('');
  // The list remembers which search it belongs to. "Loading" is simply "the list
  // on screen is for an older search", so no state is set inside the effect itself.
  const [result, setResult] = useState({ search: null, users: [] });
  const loading = result.search !== search;
  const users = result.users;

  useEffect(() => {
    let cancelled = false;
    api.get('/users', { params: { limit: 100, search } })
      .then(r => { if (!cancelled) setResult({ search, users: r.data.data || [] }); })
      .catch(() => { if (!cancelled) setResult({ search, users: [] }); });
    return () => { cancelled = true; };
  }, [search]);

  const toggleActive = async (id) => {
    try { const r = await api.patch(`/users/${id}/toggle-active`); setResult(cur => ({ ...cur, users: cur.users.map(u => u._id === id ? r.data.data : u) })); toast.success('Updated'); } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>User Management</h2>
        <a href={`${import.meta.env.VITE_API_URL}/admin/export/users`} className="btn btn-outline btn-sm" target="_blank" rel="noreferrer"><Download size={14} /> Export CSV</a>
      </div>
      <input className="input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16 }} />
      <div className="card" style={{ overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 40 }} />)}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#5a6270' }}>
            <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p>No users found matching your search.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ background: 'var(--color-surface-dark)' }}>
              {['Name', 'Email', 'Role', 'Department', 'Active', 'Joined', 'Actions'].map(h => <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>)}
            </tr></thead>
            <tbody>{users.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: '12px 14px', color: '#5a6270' }}>{u.email}</td>
                <td style={{ padding: '12px 14px' }}><span className={`badge badge-${u.role === 'admin' ? 'technical' : u.role === 'student' ? 'sports' : 'academic'}`}>{u.role}</span></td>
                <td style={{ padding: '12px 14px', color: '#5a6270' }}>{u.department || '-'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.isActive ? 'var(--color-success)' : 'var(--color-error)', display: 'inline-block', marginRight: 6 }}></span>
                  {u.isActive ? 'Yes' : 'No'}
                </td>
                <td style={{ padding: '12px 14px', color: '#5a6270', fontSize: 12 }}>{u.createdAt ? format(new Date(u.createdAt), 'MMM dd, yyyy') : ''}</td>
                <td style={{ padding: '12px 14px' }}>
                  {u.role !== 'admin' && (
                    <button onClick={() => toggleActive(u._id)} 
                      style={{ 
                        padding: '6px 12px', borderRadius: 8, border: `1px solid ${u.isActive ? 'var(--color-error)' : 'var(--color-success)'}`, 
                        color: u.isActive ? 'var(--color-error)' : 'var(--color-success)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600 
                      }}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminRequests() {
  const [requests, setRequests] = useState([]);
  useEffect(() => { api.get('/event-requests').then(r => setRequests(r.data.data || [])).catch(() => {}); }, []);

  const handleReview = async (id, action) => {
    const rejectionReason = action === 'reject' ? prompt('Rejection reason:') : '';
    if (action === 'reject' && rejectionReason === null) return;
    try {
      await api.patch(`/event-requests/${id}/review`, { action, rejectionReason });
      setRequests(rs => rs.map(r => r._id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
      toast.success(`Request ${action}d`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Event Requests</h2>
      {requests.map(req => (
        <div key={req._id} className="card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{req.eventData?.title}</h3>
              <p style={{ fontSize: 13, color: '#5a6270', marginTop: 4 }}>By: {req.submittedBy?.name} ({req.submittedBy?.email}) • {req.requestType}</p>
              <p style={{ fontSize: 13, color: '#5a6270' }}>Venue: {req.eventData?.canonicalVenue || req.eventData?.venue} • {req.eventData?.startDateTime ? format(new Date(req.eventData.startDateTime), 'MMM dd, yyyy') : ''}</p>
              {req.conflictWarnings?.length > 0 && (
                <div style={{ background: '#fffbeb', padding: '8px 12px', borderRadius: 8, marginTop: 8, fontSize: 13, color: 'var(--color-warning)' }}>
                  Conflict: {req.conflictWarnings.map(w => w.message).join('; ')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`badge badge-${req.status === 'approved' ? 'approved' : req.status === 'rejected' ? 'rejected' : 'pending'}`}>{req.status}</span>
              {req.status === 'pending' && (
                <>
                  <button onClick={() => handleReview(req._id, 'approve')} className="btn btn-primary btn-sm">Approve</button>
                  <button onClick={() => handleReview(req._id, 'reject')} className="btn btn-danger btn-sm">Reject</button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {requests.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#5a6270' }} className="card">
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p style={{ fontSize: 16 }}>No pending event requests.</p>
        </div>
      )}
    </div>
  );
}

function AdminAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/admin/analytics').then(r => setData(r.data.data)).catch(() => {}); }, []);
  if (!data) return <div className="skeleton" style={{ height: 300 }} />;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Analytics</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Events by Category</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.eventsPerCategory?.map(d => ({ name: d._id, count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Top Venues</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topVenues?.map(d => ({ name: d._id?.substring(0, 15), count: d.count }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip />
                <Bar dataKey="count" fill="var(--color-primary-light)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { if (!isAdmin) navigate('/dashboard'); }, [isAdmin]);

  const tabs = [
    { path: '/admin', label: 'Dashboard', icon: BarChart3 },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/requests', label: 'Requests', icon: FileText },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 24, letterSpacing: '-0.5px' }}>
        Admin <span style={{ color: 'var(--color-accent)' }}>Panel</span>
      </h1>
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: '#f5f5f5', borderRadius: 12, padding: 4, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <Link key={tab.path} to={tab.path} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
            textDecoration: 'none', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
            background: location.pathname === tab.path ? 'white' : 'transparent',
            color: location.pathname === tab.path ? '#1a237e' : '#5a6270',
            boxShadow: location.pathname === tab.path ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
          }}>
            <tab.icon size={16} /> {tab.label}
          </Link>
        ))}
      </div>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Routes>
    </div>
  );
}
