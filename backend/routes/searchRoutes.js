// Global search routes
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { optionalAuth } = require('../middleware/auth');
const { parsePagination } = require('../lib/pagination');
const { sendError } = require('../lib/respond');

// GET /api/search: Global search across events
router.get('/', optionalAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });
    if (q.length < 2) return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });

    const filter = { $text: { $search: q }, status: { $in: ['approved', 'ongoing', 'completed'] } };
    if (!req.user) filter.isPublic = true;

    const events = await Event.find(filter, { score: { $meta: 'textScore' } })
      .populate('organizer', 'name email avatar')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(filter);
    res.json({ success: true, data: events, pagination: { page, limit, total } });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
