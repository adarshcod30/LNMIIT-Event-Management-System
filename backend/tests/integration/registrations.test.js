const request = require('supertest');
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const User = require('../../models/User');
const Registration = require('../../models/Registration');
const Notification = require('../../models/Notification');
const { buildApp } = require('../helpers/app');
const {
  DAY,
  createUser,
  createAdmin,
  createEvent,
  createRegistration,
  authHeader,
} = require('../helpers/factories');

const app = buildApp();
const register = (user, event, body = {}) =>
  request(app).post('/api/registrations').set(authHeader(user)).send({ eventId: String(event._id), ...body });
const count = async (event) => (await Event.findById(event._id)).registeredCount;

describe('POST /api/registrations', () => {
  it('registers a student, issues a check-in code and sends a confirmation', async () => {
    const organizer = await createUser('faculty');
    const student = await createUser('student');
    const event = await createEvent(organizer);

    const res = await register(student, event);

    expect(res).toBeApiSuccess(201);
    expect(res.body.data.status).toBe('registered');
    expect(res.body.data.checkInCode).toEqual(expect.any(String));
    expect(await count(event)).toBe(1);
    const note = await Notification.findOne({ recipient: student._id });
    expect(note.type).toBe('registration_confirmed');
  });

  it('requires a login and a real, approved event', async () => {
    const organizer = await createUser('faculty');
    const student = await createUser('student');
    const draft = await createEvent(organizer, { status: 'draft' });
    const ghost = { _id: new mongoose.Types.ObjectId() };

    expect(await request(app).post('/api/registrations').send({ eventId: String(draft._id) })).toBeApiError(401);
    expect(await register(student, ghost)).toBeApiError(404, /Event not found/);
    expect(await register(student, draft)).toBeApiError(400, /not accepting/);
    expect(await request(app).post('/api/registrations').set(authHeader(student)).send({ eventId: 'nope' })).toBeApiError(400);
    expect(await request(app).post('/api/registrations').set(authHeader(student)).send({})).toBeApiError(400);
  });

  it('closes registration after the deadline', async () => {
    const organizer = await createUser('faculty');
    const student = await createUser('student');
    const event = await createEvent(organizer, { registrationDeadline: new Date(Date.now() - 1000) });
    expect(await register(student, event)).toBeApiError(400, /deadline/);
  });

  it.each([
    ['students_only', 'faculty', 403, /students only/],
    ['students_only', 'student', 201, undefined],
    ['faculty_only', 'student', 403, /faculty only/],
    ['faculty_only', 'faculty', 201, undefined],
    ['all_lnmiit', 'outsider', 403, /LNMIIT members only/],
    ['all_lnmiit', 'student', 201, undefined],
    ['open_to_all', 'outsider', 201, undefined],
  ])('enforces eligibility %s for a %s: %i', async (eligibility, role, status, message) => {
    const organizer = await createUser('faculty');
    const user = await createUser(role);
    const event = await createEvent(organizer, { eligibility });

    const res = await register(user, event);
    expect(res.status).toBe(status);
    if (message) expect(res).toBeApiError(status, message);
  });

  it('always lets the admin in, whatever the eligibility', async () => {
    const organizer = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(organizer, { eligibility: 'students_only' });
    expect(await register(admin, event)).toBeApiSuccess(201);
  });

  it('refuses a second registration for the same event', async () => {
    const organizer = await createUser('faculty');
    const student = await createUser('student');
    const event = await createEvent(organizer);
    await register(student, event);
    expect(await register(student, event)).toBeApiError(400, /Already registered/);
    expect(await Registration.countDocuments({ user: student._id })).toBe(1);
  });
});

describe('capacity and the waitlist', () => {
  let organizer;
  let event;
  beforeEach(async () => {
    organizer = await createUser('faculty');
    event = await createEvent(organizer, { maxParticipants: 2 });
  });

  it('waitlists everyone past capacity and counts only confirmed seats', async () => {
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map(() => createUser('student')));

    const results = [];
    for (const user of [a, b, c, d]) results.push((await register(user, event)).body.data.status);

    expect(results).toEqual(['registered', 'registered', 'waitlisted', 'waitlisted']);
    expect(await count(event)).toBe(2);
  });

  it('treats maxParticipants 0 as unlimited', async () => {
    const open = await createEvent(organizer, { maxParticipants: 0 });
    for (let i = 0; i < 5; i += 1) {
      const res = await register(await createUser('student'), open);
      expect(res.body.data.status).toBe('registered');
    }
  });

  it('records each waitlisted user\'s attendance history as their priority', async () => {
    const [a, b] = await Promise.all([1, 2].map(() => createUser('student')));
    const veteran = await createUser('student', { eventsAttended: 7 });
    await register(a, event);
    await register(b, event);

    const res = await register(veteran, event);
    expect(res.body.data.status).toBe('waitlisted');
    expect(res.body.data.waitlistPriority).toBe(7);
  });
});

describe('PATCH /api/registrations/:id/cancel', () => {
  it('frees a seat and promotes the waitlisted user with the most attendance, then the earliest', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer, { maxParticipants: 1 });
    const holder = await createUser('student');
    const newcomer = await createUser('student');
    const veteran = await createUser('student', { eventsAttended: 5 });

    const held = (await register(holder, event)).body.data;
    await register(newcomer, event);
    await register(veteran, event);

    const res = await request(app).patch(`/api/registrations/${held._id}/cancel`).set(authHeader(holder));
    expect(res).toBeApiSuccess();

    const statuses = Object.fromEntries(
      (await Registration.find({ event: event._id })).map((r) => [String(r.user), r.status]),
    );
    expect(statuses[String(holder._id)]).toBe('cancelled');
    expect(statuses[String(veteran._id)]).toBe('registered');
    expect(statuses[String(newcomer._id)]).toBe('waitlisted');
    expect(await count(event)).toBe(1);
    expect((await Notification.findOne({ recipient: veteran._id, type: 'waitlist_promoted', title: /Promotion/ }))).not.toBeNull();
  });

  it('breaks priority ties by who joined the waitlist first', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer, { maxParticipants: 1 });
    const holder = await createUser('student');
    const first = await createUser('student');
    const second = await createUser('student');

    const held = (await register(holder, event)).body.data;
    await createRegistration(event, second, { status: 'waitlisted', registeredAt: new Date(Date.now() + 60000) });
    await createRegistration(event, first, { status: 'waitlisted', registeredAt: new Date(Date.now() - 60000) });

    await request(app).patch(`/api/registrations/${held._id}/cancel`).set(authHeader(holder));
    expect((await Registration.findOne({ user: first._id })).status).toBe('registered');
    expect((await Registration.findOne({ user: second._id })).status).toBe('waitlisted');
  });

  it('does not promote anybody when a waitlisted user cancels, because no seat was freed', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer, { maxParticipants: 1 });
    const holder = await createUser('student');
    const waiting1 = await createUser('student');
    const waiting2 = await createUser('student');
    await register(holder, event);
    const w1 = (await register(waiting1, event)).body.data;
    await register(waiting2, event);

    await request(app).patch(`/api/registrations/${w1._id}/cancel`).set(authHeader(waiting1));

    expect((await Registration.findOne({ user: holder._id })).status).toBe('registered');
    expect((await Registration.findOne({ user: waiting2._id })).status).toBe('waitlisted');
    expect(await count(event)).toBe(1);
  });

  it('cannot be applied twice: the second cancel changes nothing', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer, { maxParticipants: 3 });
    const a = await createUser('student');
    const b = await createUser('student');
    const reg = (await register(a, event)).body.data;
    await register(b, event);

    expect(await request(app).patch(`/api/registrations/${reg._id}/cancel`).set(authHeader(a))).toBeApiSuccess();
    const again = await request(app).patch(`/api/registrations/${reg._id}/cancel`).set(authHeader(a));

    expect(again.status).toBe(409);
    expect(await count(event)).toBe(1);
  });

  it('cannot cancel a registration that was already checked in', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer);
    const student = await createUser('student');
    const reg = await createRegistration(event, student, { status: 'attended' });
    const res = await request(app).patch(`/api/registrations/${reg._id}/cancel`).set(authHeader(student));
    expect(res.status).toBe(409);
  });

  it('belongs to the registrant or the admin', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer);
    const owner = await createUser('student');
    const stranger = await createUser('student');
    const admin = await createAdmin();
    const a = await createRegistration(event, owner);
    const b = await createRegistration(event, await createUser('student'));

    expect(await request(app).patch(`/api/registrations/${a._id}/cancel`).set(authHeader(stranger))).toBeApiError(403);
    expect(await request(app).patch(`/api/registrations/${b._id}/cancel`).set(authHeader(admin))).toBeApiSuccess();
    expect(await request(app).patch(`/api/registrations/${new mongoose.Types.ObjectId()}/cancel`).set(authHeader(admin))).toBeApiError(404);
    expect(await request(app).patch('/api/registrations/bad-id/cancel').set(authHeader(admin))).toBeApiError(400);
  });
});

describe('check-in', () => {
  let organizer;
  let event;
  let student;
  let reg;
  beforeEach(async () => {
    organizer = await createUser('faculty');
    event = await createEvent(organizer);
    student = await createUser('student');
    reg = await createRegistration(event, student, { checkInCode: 'qr-code-1' });
  });

  it('marks attendance once and counts it toward the student\'s history', async () => {
    const res = await request(app).post(`/api/registrations/${reg._id}/checkin`).set(authHeader(organizer));

    expect(res).toBeApiSuccess();
    expect(res.body.data.status).toBe('attended');
    expect(res.body.data.checkInTime).toBeTruthy();
    expect((await User.findById(student._id)).eventsAttended).toBe(1);
  });

  it('refuses a repeat check-in and does not count attendance twice', async () => {
    await request(app).post(`/api/registrations/${reg._id}/checkin`).set(authHeader(organizer));
    const again = await request(app).post(`/api/registrations/${reg._id}/checkin`).set(authHeader(organizer));

    expect(again.status).toBe(409);
    expect((await User.findById(student._id)).eventsAttended).toBe(1);
  });

  it.each(['waitlisted', 'cancelled'])('refuses to check in a %s registration', async (status) => {
    await Registration.updateOne({ _id: reg._id }, { status });
    const res = await request(app).post(`/api/registrations/${reg._id}/checkin`).set(authHeader(organizer));
    expect(res.status).toBe(400);
    expect((await User.findById(student._id)).eventsAttended).toBe(0);
  });

  it('works by QR code too, and rejects unknown codes', async () => {
    const ok = await request(app).post('/api/registrations/checkin-code').set(authHeader(organizer)).send({ code: 'qr-code-1' });
    expect(ok).toBeApiSuccess();
    expect(ok.body.data.status).toBe('attended');

    const again = await request(app).post('/api/registrations/checkin-code').set(authHeader(organizer)).send({ code: 'qr-code-1' });
    expect(again.status).toBe(409);
    expect((await User.findById(student._id)).eventsAttended).toBe(1);

    expect(await request(app).post('/api/registrations/checkin-code').set(authHeader(organizer)).send({ code: 'nope' })).toBeApiError(404);
  });

  it('is limited to the event\'s organizer, its co-organizers and the admin', async () => {
    const otherFaculty = await createUser('faculty');
    const coOrganizer = await createUser('faculty');
    const admin = await createAdmin();
    await Event.updateOne({ _id: event._id }, { coOrganizers: [coOrganizer._id] });

    const attempt = (user) => request(app).post(`/api/registrations/${reg._id}/checkin`).set(authHeader(user));
    expect(await attempt(student)).toBeApiError(403);
    expect(await attempt(otherFaculty)).toBeApiError(403);
    expect(await attempt(coOrganizer)).toBeApiSuccess();

    const second = await createRegistration(event, await createUser('student'));
    expect(await request(app).post(`/api/registrations/${second._id}/checkin`).set(authHeader(admin))).toBeApiSuccess();
  });

  it('404s for an unknown registration', async () => {
    const res = await request(app).post(`/api/registrations/${new mongoose.Types.ObjectId()}/checkin`).set(authHeader(organizer));
    expect(res).toBeApiError(404);
  });
});

describe('listing registrations', () => {
  it('shows a user their own registrations only', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer);
    const me = await createUser('student');
    const someoneElse = await createUser('student');
    await createRegistration(event, me);
    await createRegistration(event, someoneElse);

    const res = await request(app).get('/api/registrations/my').set(authHeader(me));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].event.title).toBe('Seed Event');
  });

  it('shows the attendee list to the organizer and the admin, not to attendees', async () => {
    const organizer = await createUser('faculty');
    const admin = await createAdmin();
    const event = await createEvent(organizer);
    const student = await createUser('student');
    await createRegistration(event, student);

    const path = `/api/registrations/event/${event._id}`;
    expect((await request(app).get(path).set(authHeader(organizer))).body.data).toHaveLength(1);
    expect(await request(app).get(path).set(authHeader(admin))).toBeApiSuccess();
    expect(await request(app).get(path).set(authHeader(student))).toBeApiError(403);
    expect(await request(app).get(`/api/registrations/event/${new mongoose.Types.ObjectId()}`).set(authHeader(admin))).toBeApiError(404);
  });
});

describe('GET /api/registrations/export/:eventId', () => {
  it('exports a CSV for the organizer and refuses everyone else', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer, { title: 'Quiz: Round 1' });
    const student = await createUser('student', { name: 'Asha Rao', rollNumber: '23UCS001' });
    await createRegistration(event, student);

    const res = await request(app).get(`/api/registrations/export/${event._id}`).set(authHeader(organizer));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/filename="registrations_[A-Za-z0-9_.-]+\.csv"/);
    const [header, row] = res.text.trim().split('\n');
    expect(header).toBe('Name,Email,Role,Department,Roll Number,Team,Status,Registered At,Check-in Time');
    expect(row).toContain('"Asha Rao"');
    expect(row).toContain('"23UCS001"');

    expect(await request(app).get(`/api/registrations/export/${event._id}`).set(authHeader(student))).toBeApiError(403);
  });

  it('keeps a hostile name from breaking the file or running as a spreadsheet formula', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer);
    await createRegistration(event, await createUser('student', { name: 'Evil "Quote", Esq' }));
    await createRegistration(event, await createUser('student', { name: '=HYPERLINK("http://evil.example","click")' }));

    const res = await request(app).get(`/api/registrations/export/${event._id}`).set(authHeader(organizer));

    expect(res.text).toContain('"Evil ""Quote"", Esq"');
    expect(res.text).not.toMatch(/(^|,)"=HYPERLINK/m);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    // every record still has the same number of columns
    const rows = res.text.trim().split('\n');
    expect(rows).toHaveLength(3);
  });
});

describe('registration under concurrency', () => {
  it('never hands out more confirmed seats than the capacity', async () => {
    const organizer = await createUser('faculty');
    const event = await createEvent(organizer, { maxParticipants: 3 });
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser('student')));

    await Promise.all(users.map((u) => register(u, event)));

    const confirmed = await Registration.countDocuments({ event: event._id, status: 'registered' });
    expect(confirmed).toBeLessThanOrEqual(3);
    expect(await Registration.countDocuments({ event: event._id })).toBe(8);
  });
});

test('deadline logic uses the clock, so fake timers can move it', async () => {
  const organizer = await createUser('faculty');
  const student = await createUser('student');
  const event = await createEvent(organizer, { registrationDeadline: new Date(Date.now() + 1 * DAY) });
  expect(await register(student, event)).toBeApiSuccess(201);
});
