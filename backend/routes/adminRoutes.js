// Admin routes - dashboard, analytics, audit
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const EventRequest = require('../models/EventRequest');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { authenticate, authorize } = require('../middleware/auth');
const { parsePagination } = require('../lib/pagination');
const { csvRow } = require('../lib/sanitize');
const { sendError } = require('../lib/respond');

// Middleware: all admin routes require admin role
router.use(authenticate, authorize('admin'));

// GET /api/admin/dashboard: Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [totalUsers, totalEvents, totalRegistrations, pendingRequests, activeEvents, usersByRole] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Registration.countDocuments(),
      EventRequest.countDocuments({ status: 'pending' }),
      Event.countDocuments({ status: { $in: ['approved', 'ongoing'] } }),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ]);

    const upcomingEvents = await Event.find({ status: 'approved', startDateTime: { $gte: new Date() } })
      .populate('organizer', 'name email')
      .sort({ startDateTime: 1 })
      .limit(5);

    const recentRegistrations = await Registration.find()
      .populate('user', 'name email')
      .populate('event', 'title')
      .sort({ registeredAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: { totalUsers, totalEvents, totalRegistrations, pendingRequests, activeEvents },
        usersByRole: usersByRole.reduce((acc, r) => { acc[r._id] = r.count; return acc; }, {}),
        upcomingEvents,
        recentRegistrations,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/admin/analytics: Analytics data
router.get('/analytics', async (req, res) => {
  try {
    const eventsPerCategory = await Event.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
    const eventsPerMonth = await Event.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$startDateTime' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);
    const topVenues = await Event.aggregate([
      { $match: { canonicalVenue: { $ne: null } } },
      { $group: { _id: '$canonicalVenue', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const registrationsPerEvent = await Registration.aggregate([
      { $group: { _id: '$event', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $project: { title: '$event.title', count: 1 } },
    ]);
    const userGrowth = await User.aggregate([
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, role: '$role' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]);

    res.json({ success: true, data: { eventsPerCategory, eventsPerMonth, topVenues, registrationsPerEvent, userGrowth } });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/admin/audit-logs: audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const logs = await AuditLog.find()
      .populate('adminId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await AuditLog.countDocuments();
    res.json({ success: true, data: logs, pagination: { page, limit, total } });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/admin/export/users: users as CSV
router.get('/export/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const rows = ['Name,Email,Role,Department,Roll Number,Active,Joined'];
    users.forEach((u) => rows.push(csvRow([
      u.name, u.email, u.role, u.department, u.rollNumber, u.isActive, u.createdAt && u.createdAt.toISOString(),
    ])));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
    res.send(`${rows.join('\n')}\n`);
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/admin/export/events: events as CSV
router.get('/export/events', async (req, res) => {
  try {
    const events = await Event.find().populate('organizer', 'name email').sort({ createdAt: -1 });
    const rows = ['Title,Category,Type,Venue,Start,End,Status,Organizer,Registrations'];
    events.forEach((e) => rows.push(csvRow([
      e.title, e.category, e.eventType, e.canonicalVenue,
      e.startDateTime && e.startDateTime.toISOString(), e.endDateTime && e.endDateTime.toISOString(),
      e.status, e.organizer && e.organizer.name, e.registeredCount,
    ])));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="events_export.csv"');
    res.send(`${rows.join('\n')}\n`);
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
