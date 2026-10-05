const request = require('supertest');
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const EventRequest = require('../../models/EventRequest');
const Notification = require('../../models/Notification');
const { buildApp } = require('../helpers/app');
const { DAY, HOUR, createUser, createAdmin, createEvent, eventPayload, authHeader } = require('../helpers/factories');

const app = buildApp();
const submit = (user, eventData, extra = {}) =>
  request(app).post('/api/event-requests').set(authHeader(user)).send({ eventData, ...extra });

describe('POST /api/event-requests', () => {
  it('records a student\'s request, resolves the venue and notifies every admin', async () => {
    const student = await createUser('student');
    const admin = await createAdmin();

    const res = await submit(student, eventPayload({ venue: 'lt 4' }));

    expect(res).toBeApiSuccess(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.requestType).toBe('create');
    expect(res.body.data.eventData.canonicalVenue).toBe('LT-4');
    const note = await Notification.findOne({ recipient: admin._id });
    expect(note.type).toBe('request_submitted');
    expect(note.message).toContain('Hack the Hall');
  });

  it('warns about a venue clash but still accepts the request', async () => {
    const student = await createUser('student');
    const faculty = await createUser('faculty');
    const start = new Date(Date.now() + 3 * DAY);
    await createEvent(faculty, { title: 'Taken', canonicalVenue: 'LT-1', startDateTime: start });

    const res = await submit(student, eventPayload({
      venue: 'LT-1',
      startDateTime: start.toISOString(),
      endDateTime: new Date(start.getTime() + HOUR).toISOString(),
    }));

    expect(res).toBeApiSuccess(201);
    expect(res.body.data.conflictWarnings).toHaveLength(1);
    expect(res.body.data.conflictWarnings[0].message).toContain('Taken');
  });

  it('is for students only', async () => {
    const faculty = await createUser('faculty');
    const outsider = await createUser('outsider');
    expect(await submit(faculty, eventPayload())).toBeApiError(403);
    expect(await submit(outsider, eventPayload())).toBeApiError(403);
    expect(await request(app).post('/api/event-requests').send({ eventData: eventPayload() })).toBeApiError(401);
  });

  it('needs event data with a future start date', async () => {
    const student = await createUser('student');
    expect(await request(app).post('/api/event-requests').set(authHeader(student)).send({})).toBeApiError(400, /Event data required/);
    expect(await submit(student, eventPayload({ startDateTime: new Date(Date.now() - HOUR).toISOString() }))).toBeApiError(400, /past/);
  });

  it('answers 400 rather than 500 when required event details are missing', async () => {
    const student = await createUser('student');
    expect(await submit(student, eventPayload({ title: undefined }))).toBeApiError(400);
  });
});

describe('listing requests', () => {
  it('shows students their own and the admin everything, filtered by status', async () => {
    const a = await createUser('student');
    const b = await createUser('student');
    const admin = await createAdmin();
    await submit(a, eventPayload({ title: 'A1' }));
    await submit(b, eventPayload({ title: 'B1' }));
    await EventRequest.updateOne({ 'eventData.title': 'B1' }, { status: 'rejected' });

    const mine = await request(app).get('/api/event-requests/my').set(authHeader(a));
    expect(mine.body.data.map((r) => r.eventData.title)).toEqual(['A1']);

    const all = await request(app).get('/api/event-requests').set(authHeader(admin));
    expect(all.body.data).toHaveLength(2);
    const pending = await request(app).get('/api/event-requests?status=pending').set(authHeader(admin));
    expect(pending.body.data.map((r) => r.eventData.title)).toEqual(['A1']);

    expect(await request(app).get('/api/event-requests').set(authHeader(a))).toBeApiError(403);
  });
});

describe('PATCH /api/event-requests/:id/review', () => {
  async function pendingRequest(overrides = {}) {
    const student = await createUser('student');
    const admin = await createAdmin();
    const res = await submit(student, eventPayload(overrides));
    return { student, admin, requestId: res.body.data._id };
  }
  const review = (admin, id, body) =>
    request(app).patch(`/api/event-requests/${id}/review`).set(authHeader(admin)).send(body);

  it('approving creates an approved event owned by the student and tells them', async () => {
    const { student, admin, requestId } = await pendingRequest({ title: 'Chess Open' });

    const res = await review(admin, requestId, { action: 'approve', reviewNote: 'Good luck' });

    expect(res).toBeApiSuccess();
    const event = await Event.findOne({ title: 'Chess Open' });
    expect(event.status).toBe('approved');
    expect(String(event.organizer)).toBe(String(student._id));
    expect(String(event.approvedBy)).toBe(String(admin._id));
    expect(event.registeredCount).toBe(0);
    const stored = await EventRequest.findById(requestId);
    expect(stored.status).toBe('approved');
    expect(String(stored.createdEvent)).toBe(String(event._id));
    expect(stored.reviewNote).toBe('Good luck');
    expect((await Notification.findOne({ recipient: student._id, type: 'request_approved' }))).not.toBeNull();
  });

  it('does not create a second event if the same request is approved twice', async () => {
    const { admin, requestId } = await pendingRequest({ title: 'Chess Open' });
    await review(admin, requestId, { action: 'approve' });

    const again = await review(admin, requestId, { action: 'approve' });

    expect(again.status).toBe(409);
    expect(await Event.countDocuments({ title: 'Chess Open' })).toBe(1);
  });

  it('cannot approve a request that was already rejected', async () => {
    const { admin, requestId } = await pendingRequest();
    await review(admin, requestId, { action: 'reject', rejectionReason: 'No budget' });
    expect((await review(admin, requestId, { action: 'approve' })).status).toBe(409);
    expect(await Event.countDocuments()).toBe(0);
  });

  it('rejecting stores the reason and tells the student', async () => {
    const { student, admin, requestId } = await pendingRequest();
    const res = await review(admin, requestId, { action: 'reject', rejectionReason: 'Clashes with exams' });

    expect(res).toBeApiSuccess();
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejectionReason).toBe('Clashes with exams');
    const note = await Notification.findOne({ recipient: student._id, type: 'request_rejected' });
    expect(note.message).toContain('Clashes with exams');
  });

  it('survives a very long rejection reason', async () => {
    const { admin, requestId } = await pendingRequest();
    const res = await review(admin, requestId, { action: 'reject', rejectionReason: 'x'.repeat(900) });
    expect(res).toBeApiSuccess();
  });

  it('rejects an unknown action, an unknown request and a non-admin reviewer', async () => {
    const { student, admin, requestId } = await pendingRequest();
    expect(await review(admin, requestId, { action: 'maybe' })).toBeApiError(400, /approve.*reject/);
    expect(await review(admin, new mongoose.Types.ObjectId(), { action: 'approve' })).toBeApiError(404);
    expect(await review(student, requestId, { action: 'approve' })).toBeApiError(403);
    expect(await review(admin, 'bad-id', { action: 'approve' })).toBeApiError(400);
  });
});
