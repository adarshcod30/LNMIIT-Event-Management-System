// src/pages/Notifications.jsx — Notification center
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../api/axios';
import { format } from 'date-fns';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications', { params: { limit: 50 } })
      .then(r => setNotifications(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(ns => ns.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
  };

  const getIcon = (type) => {
    const icons = { event_approved: '', event_rejected: '', registration_confirmed: '', waitlist_promoted: '', team_invite: '', request_approved: '', request_rejected: '', system_announcement: '' };
    return icons[type] || '';
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}><Bell size={24} style={{ color: '#1a237e' }} /> Notifications</h1>
        <button onClick={markAllRead} className="btn btn-ghost btn-sm"><CheckCheck size={16} /> Mark all read</button>
      </div>
      {loading ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />) :
        notifications.length === 0 ? <p style={{ textAlign: 'center', color: '#5a6270', padding: 40 }}>No notifications</p> :
        notifications.map(n => (
          <div key={n._id} onClick={() => !n.isRead && markRead(n._id)} className="card" style={{
            padding: '14px 20px', marginBottom: 8, cursor: 'pointer',
            background: n.isRead ? 'white' : '#e8eaf6', borderLeft: n.isRead ? 'none' : '4px solid #1a237e',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20 }}>{getIcon(n.type)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                <div style={{ fontSize: 13, color: '#5a6270', marginTop: 2 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#b0bec5', marginTop: 6 }}>{n.createdAt ? format(new Date(n.createdAt), 'MMM dd, h:mm a') : ''}</div>
              </div>
              {n.link && <Link to={n.link} style={{ fontSize: 12, color: '#1a237e' }}>View</Link>}
            </div>
          </div>
        ))
      }
    </div>
  );
}
