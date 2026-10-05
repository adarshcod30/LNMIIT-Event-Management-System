// Registration routes with waitlist management
const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticate, authorize } = require('../middleware/auth');
const { canManageEvent } = require('../lib/permissions');
const { isObjectId, validateIdParam } = require('../lib/objectId');
const { csvRow, safeFilename } = require('../lib/sanitize');
const { sendError } = require('../lib/respond');

router.param('id', validateIdParam);
router.param('eventId', validateIdParam);

// Event.registeredCount means confirmed seats. Waitlisted and cancelled
// registrations do not count, and every change to it is a single atomic update
// so two people registering at once cannot both take the last seat.

// POST /api/registrations: register for an event
router.post('/', authenticate, async (req, res) => {
  let seatClaimed = false;
  let event;
  try {
    const { eventId, teamId } = req.body;
    if (!isObjectId(eventId)) {
      return res.status(400).json({ success: false, error: 'A valid eventId is required' });
    }
    if (teamId !== undefined && teamId !== null && !isObjectId(teamId)) {
      return res.status(400).json({ success: false, error: 'teamId is not valid' });
    }

    event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (event.status !== 'approved' && event.status !== 'ongoing') {
      return res.status(400).json({ success: false, error: 'Event not accepting registrations' });
    }

    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ success: false, error: 'Registration deadline has passed' });
    }

    const role = req.user.role;
    if (event.eligibility === 'students_only' && role !== 'student' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'This event is for students only' });
    }
    if (event.eligibility === 'faculty_only' && role !== 'faculty' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'This event is for faculty only' });
    }
    if (event.eligibility === 'all_lnmiit' && role === 'outsider') {
      return res.status(403).json({ success: false, error: 'This event is for LNMIIT members only' });
    }

    const existing = await Registration.findOne({ event: eventId, user: req.user._id });
    if (existing) return res.status(400).json({ success: false, error: 'Already registered' });

    // Claim a seat atomically, or fall onto the waitlist
    let status = 'registered';
    if (event.maxParticipants > 0) {
      const claimed = await Event.findOneAndUpdate(
        { _id: eventId, registeredCount: { $lt: event.maxParticipants } },
        { $inc: { registeredCount: 1 } },
      );
      if (claimed) seatClaimed = true;
      else status = 'waitlisted';
    } else {
      await Event.updateOne({ _id: eventId }, { $inc: { registeredCount: 1 } });
      seatClaimed = true;
    }

    const registration = await new Registration({
      event: eventId,
      user: req.user._id,
      team: teamId || null,
      status,
      checkInCode: randomUUID(),
      waitlistPriority: req.user.eventsAttended || 0,
    }).save();

    await Notification.create({
      recipient: req.user._id,
      type: status === 'registered' ? 'registration_confirmed' : 'waitlist_promoted',
      title: status === 'registered' ? 'Registration Confirmed' : 'Added to Waitlist',
      message: `You have been ${status} for "${event.title}"`.slice(0, 500),
      link: `/events/${eventId}`,
      relatedEvent: eventId,
    });

    return res.status(201).json({ success: true, data: registration, message: `Successfully ${status}` });
  } catch (error) {
    // Registration failed after a seat was taken: give the seat back
    if (seatClaimed && event) {
      await Event.updateOne({ _id: event._id }, { $inc: { registeredCount: -1 } }).catch(() => {});
    }
    if (error.code === 11000) return res.status(400).json({ success: false, error: 'Already registered' });
    return sendError(res, error);
  }
});

// GET /api/registrations/my: my registrations
router.get('/my', authenticate, async (req, res) => {
  try {
    const regs = await Registration.find({ user: req.user._id })
      .populate({ path: 'event', select: 'title startDateTime endDateTime canonicalVenue status banner category eventType' })
      .populate('team', 'name status')
      .sort({ registeredAt: -1 });
    res.json({ success: true, data: regs });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/registrations/event/:eventId: attendee list (organizers and admin)
router.get('/event/:eventId', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const regs = await Registration.find({ event: req.params.eventId })
      .populate('user', 'name email role department rollNumber avatar')
      .populate('team', 'name status')
      .sort({ registeredAt: 1 });
    return res.json({ success: true, data: regs });
  } catch (error) {
    return sendError(res, error);
  }
});

// PATCH /api/registrations/:id/cancel: cancel a registration
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, error: 'Registration not found' });
    if (reg.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    if (reg.status !== 'registered' && reg.status !== 'waitlisted') {
      return res.status(409).json({ success: false, error: `Registration is already ${reg.status}` });
    }

    // Only cancelling a confirmed seat frees anything up
    const heldSeat = reg.status === 'registered';
    reg.status = 'cancelled';
    await reg.save();

    if (heldSeat) {
      // The seat passes straight to the best waitlisted person: most events
      // attended first, then whoever joined the waitlist earliest.
      const promoted = await Registration.findOneAndUpdate(
        { event: reg.event, status: 'waitlisted' },
        { status: 'registered' },
        { sort: { waitlistPriority: -1, registeredAt: 1 }, new: true },
      );
      if (promoted) {
        const event = await Event.findById(reg.event);
        await Notification.create({
          recipient: promoted.user,
          type: 'waitlist_promoted',
          title: 'Waitlist Promotion!',
          message: `You've been promoted from the waitlist for "${event ? event.title : 'an event'}"!`.slice(0, 500),
          link: `/events/${reg.event}`,
          relatedEvent: reg.event,
        });
      } else {
        await Event.updateOne({ _id: reg.event }, { $inc: { registeredCount: -1 } });
      }
    }

    return res.json({ success: true, message: 'Registration cancelled' });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Mark a registration attended. Only the event's organizers and the admin may,
 * only a confirmed registration can be, and only once.
 */
async function checkIn(req, res, registration) {
  const event = await Event.findById(registration.event);
  if (!canManageEvent(req.user, event)) {
    return res.status(403).json({ success: false, error: 'Not authorized to check in for this event' });
  }
  if (registration.status === 'attended') {
    return res.status(409).json({ success: false, error: 'Already checked in' });
  }
  if (registration.status !== 'registered') {
    return res.status(400).json({ success: false, error: `Cannot check in a ${registration.status} registration` });
  }

  // Conditional update: if two scanners race, only one wins
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, status: 'registered' },
    { status: 'attended', checkInTime: new Date() },
    { new: true },
  );
  if (!updated) return res.status(409).json({ success: false, error: 'Already checked in' });

  await User.updateOne({ _id: registration.user }, { $inc: { eventsAttended: 1 } });
  return res.json({ success: true, data: updated, message: 'Checked in' });
}

// POST /api/registrations/checkin-code: check in by QR code
router.post('/checkin-code', authenticate, authorize('admin', 'faculty'), async (req, res) => {
  try {
    const { code } = req.body;
    if (typeof code !== 'string' || !code) {
      return res.status(404).json({ success: false, error: 'Invalid check-in code' });
    }
    const reg = await Registration.findOne({ checkInCode: code });
    if (!reg) return res.status(404).json({ success: false, error: 'Invalid check-in code' });
    return await checkIn(req, res, reg);
  } catch (error) {
    return sendError(res, error);
  }
});

// POST /api/registrations/:id/checkin: manual check-in
router.post('/:id/checkin', authenticate, authorize('admin', 'faculty'), async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, error: 'Registration not found' });
    return await checkIn(req, res, reg);
  } catch (error) {
    return sendError(res, error);
  }
});

// GET /api/registrations/export/:eventId: CSV export
router.get('/export/:eventId', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!canManageEvent(req.user, event)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const regs = await Registration.find({ event: req.params.eventId })
      .populate('user', 'name email role department rollNumber')
      .populate('team', 'name');

    const rows = ['Name,Email,Role,Department,Roll Number,Team,Status,Registered At,Check-in Time'];
    for (const r of regs) {
      rows.push(csvRow([
        r.user && r.user.name,
        r.user && r.user.email,
        r.user && r.user.role,
        r.user && r.user.department,
        r.user && r.user.rollNumber,
        (r.team && r.team.name) || 'N/A',
        r.status,
        r.registeredAt && r.registeredAt.toISOString(),
        r.checkInTime && r.checkInTime.toISOString(),
      ]));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(`registrations_${event.title}`, '.csv')}"`);
    return res.send(`${rows.join('\n')}\n`);
  } catch (error) {
    return sendError(res, error);
  }
});

module.exports = router;
