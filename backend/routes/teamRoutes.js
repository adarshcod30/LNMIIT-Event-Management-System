// Team management routes
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');
const { validateIdParam, isObjectId } = require('../lib/objectId');
const { sendError } = require('../lib/respond');

router.param('id', validateIdParam);
router.param('eventId', validateIdParam);

// POST /api/teams: Create a team
router.post('/', authenticate, async (req, res) => {
  try {
    const { eventId, name } = req.body;
    if (!isObjectId(eventId)) return res.status(400).json({ success: false, error: 'A valid eventId is required' });
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!event.isTeamEvent) return res.status(400).json({ success: false, error: 'Not a team event' });

    // Check if user is already in a team for this event
    const existingTeam = await Team.findOne({ event: eventId, $or: [{ captain: req.user._id }, { members: req.user._id }] });
    if (existingTeam) return res.status(400).json({ success: false, error: 'Already in a team for this event' });

    const team = new Team({ event: eventId, name, captain: req.user._id, members: [req.user._id] });
    await team.save();
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, error: 'Team name already taken for this event' });
    sendError(res, error);
  }
});

// POST /api/teams/:id/invite: Invite a member
router.post('/:id/invite', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!isObjectId(userId)) return res.status(400).json({ success: false, error: 'A valid userId is required' });
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' });
    if (team.captain.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, error: 'Only captain can invite' });

    const event = await Event.findById(team.event);
    if (team.members.length >= (event?.maxTeamSize || 10)) return res.status(400).json({ success: false, error: 'Team is full' });

    // Check if user is already in a team for this event
    const existingTeam = await Team.findOne({ event: team.event, $or: [{ members: userId }, { 'invites.user': userId }] });
    if (existingTeam) return res.status(400).json({ success: false, error: 'User already in a team or invited' });

    team.invites.push({ user: userId, status: 'pending' });
    await team.save();

    await Notification.create({
      recipient: userId,
      type: 'team_invite',
      title: 'Team Invite',
      message: `You've been invited to join team "${team.name}" for an event`,
      link: `/teams/${team._id}`,
    });

    res.json({ success: true, data: team });
  } catch (error) {
    sendError(res, error);
  }
});

// PATCH /api/teams/:id/respond-invite: Accept/reject invite
router.patch('/:id/respond-invite', authenticate, async (req, res) => {
  try {
    const { accept } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

    const invite = team.invites.find(i => i.user.toString() === req.user._id.toString() && i.status === 'pending');
    if (!invite) return res.status(404).json({ success: false, error: 'No pending invite found' });

    invite.status = accept ? 'accepted' : 'rejected';
    invite.respondedAt = new Date();

    if (accept) {
      team.members.push(req.user._id);
      const event = await Event.findById(team.event);
      if (team.members.length >= (event?.minTeamSize || 1)) team.status = 'complete';
    }

    await team.save();

    await Notification.create({
      recipient: team.captain,
      type: accept ? 'team_invite_accepted' : 'team_invite_rejected',
      title: accept ? 'Invite Accepted' : 'Invite Rejected',
      message: `${req.user.name} has ${accept ? 'accepted' : 'rejected'} your team invite`,
      link: `/teams/${team._id}`,
    });

    res.json({ success: true, data: team });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/teams/my: Get my teams
router.get('/my', authenticate, async (req, res) => {
  try {
    const teams = await Team.find({ $or: [{ captain: req.user._id }, { members: req.user._id }] })
      .populate('event', 'title startDateTime endDateTime status')
      .populate('captain', 'name email avatar')
      .populate('members', 'name email avatar rollNumber')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: teams });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/teams/event/:eventId: Get teams for an event
router.get('/event/:eventId', authenticate, async (req, res) => {
  try {
    const teams = await Team.find({ event: req.params.eventId })
      .populate('captain', 'name email avatar')
      .populate('members', 'name email avatar')
      .sort({ totalScore: -1, createdAt: 1 });
    res.json({ success: true, data: teams });
  } catch (error) {
    sendError(res, error);
  }
});

// DELETE /api/teams/:id: Disband team (captain only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, error: 'Team not found' });
    if (team.captain.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only captain or admin can disband' });
    }
    await Team.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Team disbanded' });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
