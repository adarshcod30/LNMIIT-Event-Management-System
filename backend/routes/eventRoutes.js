// Event routes: CRUD with conflict detection
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { resolveVenue } = require('../lib/venueResolver');
const { checkEventConflicts } = require('../lib/conflictChecker');
const { parsePagination } = require('../lib/pagination');
const { validateIdParam } = require('../lib/objectId');
const { pickFields, icsText, safeFilename } = require('../lib/sanitize');
const { recordAudit } = require('../lib/audit');
const { sendError } = require('../lib/respond');

router.param('id', validateIdParam);

// Fields a client may set. Everything else (organizer, status, approval,
// registeredCount, isPinned) is decided by the server.
const EVENT_FIELDS = [
  'title', 'description', 'eventType', 'category', 'coOrganizers',
  'venue', 'startDateTime', 'endDateTime', 'registrationDeadline',
  'eligibility', 'maxParticipants', 'minTeamSize', 'maxTeamSize', 'isTeamEvent',
  'rounds', 'tags', 'club', 'banner', 'attachments', 'isPublic', 'requiresApproval',
  'prizes', 'sponsors', 'contactEmail', 'contactPhone', 'rules', 'faqs', 'department',
  'conflictOverrideReason',
];

// Statuses anyone may see on an event's own page
const PUBLIC_STATUSES = ['approved', 'ongoing', 'completed', 'cancelled'];
const NOTIFY_TYPE = { approved: 'event_approved', rejected: 'event_rejected', cancelled: 'event_cancelled' };

const idOf = (value) => String((value && value._id) || value);

/** Can this viewer see this event at all? */
function canView(event, user) {
  if (user) {
    if (user.role === 'admin') return true;
    if (idOf(event.organizer) === String(user._id)) return true;
    if ((event.coOrganizers || []).some((c) => idOf(c) === String(user._id))) return true;
  }
  if (!PUBLIC_STATUSES.includes(event.status)) return false;
  if (!event.isPublic && (!user || user.role === 'outsider')) return false;
  return true;
}

/** Validate start/end and return an error message, or null when fine. */
function checkDates(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (start === undefined || Number.isNaN(s.getTime())) return 'A valid start date and time is required';
  if (end === undefined || Number.isNaN(e.getTime())) return 'A valid end date and time is required';
  if (e <= s) return 'Event end must be after its start';
  return null;
}

// GET /api/events: list events (public with filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, eventType, eligibility, venue, status, search, startDate, endDate, club, organizer } = req.query;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
    const filter = {};

    // Public view: only approved/ongoing public events
    if (!req.user || req.user.role === 'outsider') {
      filter.status = { $in: ['approved', 'ongoing'] };
      filter.isPublic = true;
    } else if (req.user.role !== 'admin') {
      filter.status = { $in: ['approved', 'ongoing', 'completed'] };
    }

    if (category) filter.category = category;
    if (eventType) filter.eventType = eventType;
    if (eligibility) filter.eligibility = eligibility;
    if (venue) filter.canonicalVenue = venue;
    if (status && req.user && req.user.role === 'admin') filter.status = status;
    if (club) filter.club = club;
    if (organizer) filter.organizer = organizer;
    if (search) filter.$text = { $search: String(search) };
    if (startDate) filter.startDateTime = { ...filter.startDateTime, $gte: new Date(startDate) };
    if (endDate) filter.endDateTime = { ...filter.endDateTime, $lte: new Date(endDate) };

    const events = await Event.find(filter)
      .populate('organizer', 'name email role avatar')
      .sort({ isPinned: -1, startDateTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Event.countDocuments(filter);
    res.json({ success: true, data: events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/events/:id: single event
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email role avatar department')
      .populate('coOrganizers', 'name email role avatar')
      .populate('approvedBy', 'name email');
    // 404 rather than 403, so the existence of a draft is not revealed
    if (!event || !canView(event, req.user)) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    return res.json({ success: true, data: event });
  } catch (error) {
    return sendError(res, error);
  }
});

// POST /api/events: create an event (admin or faculty)
router.post('/', authenticate, authorize('admin', 'faculty'), async (req, res) => {
  try {
    const eventData = pickFields(req.body, EVENT_FIELDS);

    const dateError = checkDates(eventData.startDateTime, eventData.endDateTime);
    if (dateError) return res.status(400).json({ success: false, error: dateError });
    if (new Date(eventData.startDateTime) < new Date()) {
      return res.status(400).json({ success: false, error: 'Event start date cannot be in the past' });
    }

    if (eventData.venue) {
      const resolution = resolveVenue(eventData.venue);
      if (!resolution.resolved) {
        return res.status(400).json({ success: false, error: resolution.error, suggestions: resolution.suggestions });
      }
      eventData.rawVenueInput = eventData.venue;
      eventData.canonicalVenue = resolution.canonical;
    }

    if (Array.isArray(eventData.rounds)) {
      for (const round of eventData.rounds) {
        if (round && round.roundVenue) {
          const r = resolveVenue(round.roundVenue);
          if (r.resolved) round.canonicalVenue = r.canonical;
        }
      }
    }

    const conflicts = await checkEventConflicts(eventData);
    if (conflicts.hasAnyConflict) {
      if (req.user.role === 'faculty') {
        return res.status(409).json({ success: false, error: 'Venue conflict detected', conflicts });
      }
      // The admin may override, but has to say why
      if (!eventData.conflictOverrideReason) {
        return res.status(409).json({
          success: false,
          error: 'Venue conflict detected. Provide conflictOverrideReason to override.',
          conflicts,
        });
      }
    }

    // Faculty and admin events are approved on creation
    eventData.organizer = req.user._id;
    eventData.status = 'approved';
    eventData.approvedBy = req.user._id;
    eventData.approvedAt = new Date();

    const event = await new Event(eventData).save();
    return res.status(201).json({ success: true, data: event, message: 'Event created successfully' });
  } catch (error) {
    return sendError(res, error);
  }
});

// PUT /api/events/:id: update an event
router.put('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (req.user.role !== 'admin' && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to edit this event' });
    }

    const updates = pickFields(req.body, EVENT_FIELDS);

    if (updates.venue && updates.venue !== event.venue) {
      const resolution = resolveVenue(updates.venue);
      if (!resolution.resolved) return res.status(400).json({ success: false, error: resolution.error });
      updates.rawVenueInput = updates.venue;
      updates.canonicalVenue = resolution.canonical;
    }

    const timesOrVenueChanged = updates.canonicalVenue || updates.startDateTime
      || updates.endDateTime || updates.rounds;
    if (timesOrVenueChanged) {
      const merged = { ...event.toObject(), ...updates };
      const dateError = checkDates(merged.startDateTime, merged.endDateTime);
      if (dateError) return res.status(400).json({ success: false, error: dateError });

      const conflicts = await checkEventConflicts(merged, event._id);
      if (conflicts.hasAnyConflict && req.user.role !== 'admin') {
        return res.status(409).json({ success: false, error: 'Venue conflict', conflicts });
      }
    }

    const updated = await Event.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('organizer', 'name email role avatar');
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendError(res, error);
  }
});

// DELETE /api/events/:id: delete an event (admin or owner)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (req.user.role !== 'admin' && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await Event.findByIdAndDelete(event._id);
    // Registrations and teams mean nothing without their event
    await Promise.all([
      Registration.deleteMany({ event: event._id }),
      Team.deleteMany({ event: event._id }),
    ]);

    if (req.user.role === 'admin') {
      await recordAudit(req, { action: 'event.deleted', targetType: 'event', targetId: event._id, details: event.title });
    }
    return res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    return sendError(res, error);
  }
});

// PATCH /api/events/:id/status: change event status (admin)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!Event.schema.path('status').enumValues.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const previous = event.status;
    event.status = status;
    if (status === 'approved') {
      event.approvedBy = req.user._id;
      event.approvedAt = new Date();
    }
    if (status === 'rejected' && rejectionReason) event.rejectionReason = String(rejectionReason);
    await event.save();

    if (NOTIFY_TYPE[status]) {
      await Notification.create({
        recipient: event.organizer,
        type: NOTIFY_TYPE[status],
        title: `Event ${status}`,
        message: `Your event "${event.title}" has been ${status}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`.slice(0, 500),
        link: `/events/${event._id}`,
        relatedEvent: event._id,
      });
    }

    await recordAudit(req, {
      action: 'event.status_changed',
      targetType: 'event',
      targetId: event._id,
      details: `${previous} -> ${status}`,
    });
    return res.json({ success: true, data: event });
  } catch (error) {
    return sendError(res, error);
  }
});

// PATCH /api/events/:id/pin: pin or unpin an event (admin)
router.patch('/:id/pin', authenticate, authorize('admin'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    event.isPinned = !event.isPinned;
    await event.save();
    await recordAudit(req, {
      action: event.isPinned ? 'event.pinned' : 'event.unpinned',
      targetType: 'event',
      targetId: event._id,
      details: event.title,
    });
    return res.json({ success: true, data: event });
  } catch (error) {
    return sendError(res, error);
  }
});

// GET /api/events/:id/ics: download an iCalendar file
router.get('/:id/ics', optionalAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'name email');
    if (!event || !canView(event, req.user)) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LNMIIT Event Hub//EN',
      'BEGIN:VEVENT',
      `UID:${event._id}@lnmiit-eventhub`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(event.startDateTime)}`,
      `DTEND:${stamp(event.endDateTime)}`,
      `SUMMARY:${icsText(event.title)}`,
      `DESCRIPTION:${icsText((event.description || '').substring(0, 200))}`,
      `LOCATION:${icsText(event.canonicalVenue || event.venue || 'LNMIIT Campus')}`,
      `ORGANIZER:${icsText((event.organizer && event.organizer.name) || 'LNMIIT')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(event.title, '.ics')}"`);
    return res.send(`${lines.join('\r\n')}\r\n`);
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
