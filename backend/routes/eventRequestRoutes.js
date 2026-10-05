// Event request routes (student event creation requests)
const express = require('express');
const router = express.Router();
const EventRequest = require('../models/EventRequest');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticate, authorize } = require('../middleware/auth');
const { resolveVenue } = require('../lib/venueResolver');
const { checkEventConflicts } = require('../lib/conflictChecker');
const { isObjectId, validateIdParam } = require('../lib/objectId');
const { pickFields, truncate } = require('../lib/sanitize');
const { recordAudit } = require('../lib/audit');
const { sendError } = require('../lib/respond');

router.param('id', validateIdParam);

// What a student may put in a request. The same list is used again when the
// admin approves, so nothing outside it can reach the created event.
const REQUEST_FIELDS = [
  'title', 'description', 'eventType', 'category', 'venue', 'canonicalVenue',
  'startDateTime', 'endDateTime', 'registrationDeadline', 'eligibility',
  'maxParticipants', 'isTeamEvent', 'minTeamSize', 'maxTeamSize', 'tags',
  'club', 'rules', 'contactEmail', 'contactPhone',
];

// POST /api/event-requests: submit a request (students)
router.post('/', authenticate, authorize('student'), async (req, res) => {
  try {
    if (!req.body.eventData || typeof req.body.eventData !== 'object') {
      return res.status(400).json({ success: false, error: 'Event data required' });
    }
    const eventData = pickFields(req.body.eventData, REQUEST_FIELDS);

    if (new Date(eventData.startDateTime) < new Date()) {
      return res.status(400).json({ success: false, error: 'Requested event start date cannot be in the past' });
    }

    if (eventData.venue) {
      const resolution = resolveVenue(eventData.venue);
      if (resolution.resolved) eventData.canonicalVenue = resolution.canonical;
    }

    // Warn about clashes but do not block: the admin decides
    const conflicts = await checkEventConflicts(eventData);
    const conflictWarnings = [];
    if (conflicts.hasAnyConflict) {
      conflicts.primaryConflict?.conflicts?.forEach((c) => {
        conflictWarnings.push({ type: 'venue', message: `Conflicts with "${c.title}" at ${c.venue}`, conflictingEvent: c });
      });
    }

    const { requestType = 'create', existingEvent } = req.body;
    if (existingEvent !== undefined && !isObjectId(existingEvent)) {
      return res.status(400).json({ success: false, error: 'existingEvent is not valid' });
    }

    const request = await new EventRequest({
      submittedBy: req.user._id,
      requestType,
      existingEvent,
      eventData,
      conflictWarnings,
    }).save();

    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: 'request_submitted',
        title: 'New Event Request',
        message: truncate(`${req.user.name} submitted a request: "${eventData.title}"`, 500),
        link: '/admin/requests',
      });
    }

    return res.status(201).json({ success: true, data: request, message: 'Request submitted' });
  } catch (error) {
    return sendError(res, error);
  }
});

// GET /api/event-requests/my: my requests
router.get('/my', authenticate, async (req, res) => {
  try {
    const requests = await EventRequest.find({ submittedBy: req.user._id })
      .populate('reviewedBy', 'name email')
      .populate('createdEvent', 'title status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/event-requests: all requests (admin)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const filter = {};
    if (typeof req.query.status === 'string') filter.status = req.query.status;

    const requests = await EventRequest.find(filter)
      .populate('submittedBy', 'name email role rollNumber')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (error) {
    sendError(res, error);
  }
});

// PATCH /api/event-requests/:id/review: approve or reject (admin)
router.patch('/:id/review', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, rejectionReason, reviewNote } = req.body;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject"' });
    }

    const request = await EventRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    // A request is decided once. Approving it again would create a second event.
    if (request.status !== 'pending') {
      return res.status(409).json({ success: false, error: `Request was already ${request.status}` });
    }

    if (action === 'approve') {
      const event = await new Event({
        ...pickFields(request.toObject().eventData, REQUEST_FIELDS),
        organizer: request.submittedBy,
        status: 'approved',
        approvedBy: req.user._id,
        approvedAt: new Date(),
      }).save();

      request.status = 'approved';
      request.createdEvent = event._id;
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      request.reviewNote = reviewNote ? String(reviewNote) : '';
      await request.save();

      await Notification.create({
        recipient: request.submittedBy,
        type: 'request_approved',
        title: 'Event Request Approved!',
        message: truncate(`Your event request "${request.eventData.title}" has been approved!`, 500),
        link: `/events/${event._id}`,
        relatedEvent: event._id,
      });
      await recordAudit(req, {
        action: 'event_request.approved',
        targetType: 'event_request',
        targetId: request._id,
        details: request.eventData.title,
      });

      return res.json({ success: true, data: { request, event }, message: 'Request approved, event created' });
    }

    const reason = rejectionReason ? String(rejectionReason) : '';
    request.status = 'rejected';
    request.rejectionReason = reason;
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    await Notification.create({
      recipient: request.submittedBy,
      type: 'request_rejected',
      title: 'Event Request Rejected',
      message: truncate(`Your event request "${request.eventData.title}" was rejected. Reason: ${reason || 'Not specified'}`, 500),
      link: '/dashboard',
    });
    await recordAudit(req, {
      action: 'event_request.rejected',
      targetType: 'event_request',
      targetId: request._id,
      details: reason,
    });

    return res.json({ success: true, data: request, message: 'Request rejected' });
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
