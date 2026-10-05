// Notification routes
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { parsePagination } = require('../lib/pagination');
const { validateIdParam } = require('../lib/objectId');
const { recordAudit } = require('../lib/audit');
const { sendError } = require('../lib/respond');

router.param('id', validateIdParam);

// GET /api/notifications: my notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({ success: true, data: notifications, unreadCount, pagination: { page, limit, total } });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/notifications/unread-count: Quick unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, data: { count } });
  } catch (error) {
    sendError(res, error);
  }
});

// PATCH /api/notifications/:id/read: Mark as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true });
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    sendError(res, error);
  }
});

// PATCH /api/notifications/read-all: Mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All marked as read' });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/notifications/broadcast: announce to everyone or one role (admin)
router.post('/broadcast', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, message, targetRole, link } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 200) {
      return res.status(400).json({ success: false, error: 'A title of up to 200 characters is required' });
    }
    if (typeof message !== 'string' || !message.trim() || message.length > 500) {
      return res.status(400).json({ success: false, error: 'A message of up to 500 characters is required' });
    }

    const filter = { isActive: true };
    if (targetRole && targetRole !== 'all') filter.role = targetRole;

    const users = await User.find(filter).select('_id');
    await Notification.insertMany(users.map((u) => ({
      recipient: u._id,
      type: 'system_announcement',
      title,
      message,
      link: typeof link === 'string' ? link : '',
    })));

    await recordAudit(req, {
      action: 'notification.broadcast',
      targetType: 'system',
      details: `"${title}" to ${targetRole || 'all'} (${users.length} users)`,
    });
    res.json({ success: true, message: `Broadcast sent to ${users.length} users` });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
