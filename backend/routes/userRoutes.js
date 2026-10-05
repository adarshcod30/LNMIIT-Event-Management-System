const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { parsePagination } = require('../lib/pagination');
const { validateIdParam } = require('../lib/objectId');
const { escapeRegex } = require('../lib/sanitize');
const { recordAudit } = require('../lib/audit');
const { sendError } = require('../lib/respond');

router.param('id', validateIdParam);

const ROLES = ['admin', 'faculty', 'student', 'outsider'];

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    // Role, email, active flag and attendance are not the user's to change
    const allowed = ['name', 'phone', 'bio', 'department', 'rollNumber', 'followedClubs'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    updates.profileComplete = true;
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, data: user });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.length < 2) return res.status(400).json({ success: false, error: 'Min 2 chars' });

    // The query is text to find, never a pattern to run
    const pattern = escapeRegex(q);
    const filter = {
      isActive: true,
      $or: [
        { name: { $regex: pattern, $options: 'i' } },
        { email: { $regex: pattern, $options: 'i' } },
        { rollNumber: { $regex: pattern, $options: 'i' } },
      ],
    };
    if (typeof req.query.role === 'string' && ROLES.includes(req.query.role)) filter.role = req.query.role;
    const users = await User.find(filter).select('name email role department rollNumber avatar').limit(20);
    return res.json({ success: true, data: users });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, search, active } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const filter = {};
    if (typeof role === 'string' && ROLES.includes(role)) filter.role = role;
    if (active !== undefined) filter.isActive = active === 'true';
    if (typeof search === 'string' && search) {
      const pattern = escapeRegex(search);
      filter.$or = [{ name: { $regex: pattern, $options: 'i' } }, { email: { $regex: pattern, $options: 'i' } }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await User.countDocuments(filter);
    res.json({ success: true, data: users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['faculty', 'student', 'outsider'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'The admin account cannot be changed' });
    }

    const previous = user.role;
    user.role = role;
    await user.save();
    await recordAudit(req, {
      action: 'user.role_changed',
      targetType: 'user',
      targetId: user._id,
      details: `${user.email}: ${previous} -> ${role}`,
    });
    return res.json({ success: true, data: user });
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/:id/toggle-active', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ success: false, error: 'Cannot deactivate admin' });
    user.isActive = !user.isActive;
    await user.save();
    await recordAudit(req, {
      action: user.isActive ? 'user.activated' : 'user.deactivated',
      targetType: 'user',
      targetId: user._id,
      details: user.email,
    });
    return res.json({ success: true, data: user });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
