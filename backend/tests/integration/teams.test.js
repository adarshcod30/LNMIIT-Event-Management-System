const request = require('supertest');
const mongoose = require('mongoose');
const Team = require('../../models/Team');
const Notification = require('../../models/Notification');
const { buildApp } = require('../helpers/app');
const { createUser, createAdmin, createEvent, authHeader } = require('../helpers/factories');

const app = buildApp();

async function teamEvent(overrides = {}) {
  const organizer = await createUser('faculty');
  return createEvent(organizer, { isTeamEvent: true, minTeamSize: 2, maxTeamSize: 3, ...overrides });
}
const createTeam = (user, event, name = 'Byte Me') =>
  request(app).post('/api/teams').set(authHeader(user)).send({ eventId: String(event._id), name });

describe('POST /api/teams', () => {
  it('creates a team with the creator as captain and first member', async () => {
    const captain = await createUser('student');
    const event = await teamEvent();
    const res = await createTeam(captain, event);

    expect(res).toBeApiSuccess(201);
    expect(String(res.body.data.captain)).toBe(String(captain._id));
    expect(res.body.data.members).toEqual([String(captain._id)]);
    expect(res.body.data.status).toBe('incomplete');
  });

  it('needs a login, an existing event and a team event', async () => {
    const student = await createUser('student');
    const solo = await createEvent(await createUser('faculty'), { isTeamEvent: false });
    expect(await request(app).post('/api/teams').send({})).toBeApiError(401);
    expect(await createTeam(student, { _id: new mongoose.Types.ObjectId() })).toBeApiError(404);
    expect(await createTeam(student, solo)).toBeApiError(400, /Not a team event/);
  });

  it('refuses a second team for the same person and a reused team name', async () => {
    const a = await createUser('student');
    const b = await createUser('student');
    const event = await teamEvent();
    await createTeam(a, event, 'Alpha');

    expect(await createTeam(a, event, 'Beta')).toBeApiError(400, /Already in a team/);
    expect(await createTeam(b, event, 'Alpha')).toBeApiError(400, /already taken/);
  });
});

describe('invites', () => {
  it('lets only the captain invite, notifies the invitee and stops when the team is full', async () => {
    const captain = await createUser('student');
    const member = await createUser('student');
    const outsider = await createUser('student');
    const event = await teamEvent({ maxTeamSize: 2 });
    const team = (await createTeam(captain, event)).body.data;

    expect(await request(app).post(`/api/teams/${team._id}/invite`).set(authHeader(member)).send({ userId: String(outsider._id) })).toBeApiError(403);

    const invited = await request(app).post(`/api/teams/${team._id}/invite`).set(authHeader(captain)).send({ userId: String(member._id) });
    expect(invited).toBeApiSuccess();
    expect((await Notification.findOne({ recipient: member._id })).type).toBe('team_invite');

    // simulate the invite being accepted, then the team is at its limit of 2
    await Team.updateOne({ _id: team._id }, { $push: { members: member._id } });
    const full = await request(app).post(`/api/teams/${team._id}/invite`).set(authHeader(captain)).send({ userId: String(outsider._id) });
    expect(full).toBeApiError(400, /full/);
  });

  it('will not invite someone who is already invited or in a team for the event', async () => {
    const captain = await createUser('student');
    const rival = await createUser('student');
    const target = await createUser('student');
    const event = await teamEvent();
    const mine = (await createTeam(captain, event, 'Mine')).body.data;
    const theirs = (await createTeam(rival, event, 'Theirs')).body.data;

    await request(app).post(`/api/teams/${mine._id}/invite`).set(authHeader(captain)).send({ userId: String(target._id) });
    const dup = await request(app).post(`/api/teams/${theirs._id}/invite`).set(authHeader(rival)).send({ userId: String(target._id) });
    expect(dup).toBeApiError(400, /already in a team or invited/);
  });

  it('404s for an unknown team', async () => {
    const captain = await createUser('student');
    const res = await request(app).post(`/api/teams/${new mongoose.Types.ObjectId()}/invite`).set(authHeader(captain)).send({ userId: String(captain._id) });
    expect(res).toBeApiError(404);
  });
});

describe('PATCH /api/teams/:id/respond-invite', () => {
  async function invited() {
    const captain = await createUser('student');
    const invitee = await createUser('student');
    const event = await teamEvent({ minTeamSize: 2 });
    const team = (await createTeam(captain, event)).body.data;
    await request(app).post(`/api/teams/${team._id}/invite`).set(authHeader(captain)).send({ userId: String(invitee._id) });
    return { captain, invitee, team };
  }

  it('adds the invitee, completes the team once it reaches the minimum size and tells the captain', async () => {
    const { captain, invitee, team } = await invited();
    const res = await request(app).patch(`/api/teams/${team._id}/respond-invite`).set(authHeader(invitee)).send({ accept: true });

    expect(res).toBeApiSuccess();
    expect(res.body.data.members).toHaveLength(2);
    expect(res.body.data.status).toBe('complete');
    expect((await Notification.findOne({ recipient: captain._id, type: 'team_invite_accepted' }))).not.toBeNull();
  });

  it('records a rejection without adding the member', async () => {
    const { captain, invitee, team } = await invited();
    const res = await request(app).patch(`/api/teams/${team._id}/respond-invite`).set(authHeader(invitee)).send({ accept: false });

    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.invites[0].status).toBe('rejected');
    expect((await Notification.findOne({ recipient: captain._id, type: 'team_invite_rejected' }))).not.toBeNull();
  });

  it('answers 404 to someone with no pending invite and when the invite was already answered', async () => {
    const { invitee, team } = await invited();
    const stranger = await createUser('student');
    expect(await request(app).patch(`/api/teams/${team._id}/respond-invite`).set(authHeader(stranger)).send({ accept: true })).toBeApiError(404);

    await request(app).patch(`/api/teams/${team._id}/respond-invite`).set(authHeader(invitee)).send({ accept: true });
    expect(await request(app).patch(`/api/teams/${team._id}/respond-invite`).set(authHeader(invitee)).send({ accept: true })).toBeApiError(404);
  });
});

describe('listing and disbanding', () => {
  it('lists my teams and the teams of an event', async () => {
    const a = await createUser('student');
    const b = await createUser('student');
    const event = await teamEvent();
    await createTeam(a, event, 'A-team');
    await createTeam(b, event, 'B-team');

    const mine = await request(app).get('/api/teams/my').set(authHeader(a));
    expect(mine.body.data.map((t) => t.name)).toEqual(['A-team']);

    const all = await request(app).get(`/api/teams/event/${event._id}`).set(authHeader(a));
    expect(all.body.data.map((t) => t.name).sort()).toEqual(['A-team', 'B-team']);
  });

  it('lets the captain or the admin disband a team, and nobody else', async () => {
    const captain = await createUser('student');
    const other = await createUser('student');
    const admin = await createAdmin();
    const event = await teamEvent();
    const one = (await createTeam(captain, event, 'One')).body.data;
    const two = (await createTeam(await createUser('student'), event, 'Two')).body.data;

    expect(await request(app).delete(`/api/teams/${one._id}`).set(authHeader(other))).toBeApiError(403);
    expect(await request(app).delete(`/api/teams/${one._id}`).set(authHeader(captain))).toBeApiSuccess();
    expect(await request(app).delete(`/api/teams/${two._id}`).set(authHeader(admin))).toBeApiSuccess();
    expect(await request(app).delete(`/api/teams/${two._id}`).set(authHeader(admin))).toBeApiError(404);
  });
});
