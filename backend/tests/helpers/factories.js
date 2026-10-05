const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Event = require('../../models/Event');
const Registration = require('../../models/Registration');
const { generateAccessToken, generateRefreshToken } = require('../../lib/jwt');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let counter = 0;
const next = () => ++counter;

const EMAILS = {
  admin: () => 'admin@lnmiit.ac.in',
  faculty: () => `faculty${next()}@lnmiit.ac.in`,
  student: () => `23ucs${String(next()).padStart(3, '0')}@lnmiit.ac.in`,
  outsider: () => `visitor${next()}@gmail.com`,
};

async function createUser(role = 'student', overrides = {}) {
  const email = overrides.email || EMAILS[role]();
  const user = await User.create({
    name: `${role} ${email.split('@')[0]}`,
    email,
    role,
    isActive: true,
    profileComplete: true,
    ...overrides,
  });
  return user;
}

async function createAdmin(password = 'S3cure-admin-pass', overrides = {}) {
  // Low bcrypt cost: the real service uses 12, which would slow every test file
  const hash = await bcrypt.hash(password, 4);
  return createUser('admin', { password: hash, mustChangePassword: false, ...overrides });
}

const authHeader = (user) => ({ Authorization: `Bearer ${generateAccessToken(user)}` });
const refreshTokenFor = (user) => generateRefreshToken(user);

function eventPayload(overrides = {}) {
  const start = new Date(Date.now() + 2 * DAY);
  return {
    title: 'Hack the Hall',
    description: 'A 24 hour hackathon',
    eventType: 'hackathon',
    category: 'technical',
    venue: 'LT-1',
    startDateTime: start.toISOString(),
    endDateTime: new Date(start.getTime() + 3 * HOUR).toISOString(),
    eligibility: 'all_lnmiit',
    ...overrides,
  };
}

async function createEvent(organizer, overrides = {}) {
  const start = overrides.startDateTime ? new Date(overrides.startDateTime) : new Date(Date.now() + 2 * DAY);
  return Event.create({
    title: 'Seed Event',
    description: 'Created directly in the database',
    eventType: 'workshop',
    category: 'technical',
    organizer: organizer._id,
    venue: 'LT-1',
    canonicalVenue: 'LT-1',
    startDateTime: start,
    endDateTime: new Date(start.getTime() + 2 * HOUR),
    eligibility: 'all_lnmiit',
    status: 'approved',
    ...overrides,
  });
}

async function createRegistration(event, user, overrides = {}) {
  return Registration.create({
    event: event._id,
    user: user._id,
    status: 'registered',
    checkInCode: `code-${next()}`,
    ...overrides,
  });
}

module.exports = {
  HOUR,
  DAY,
  createUser,
  createAdmin,
  createEvent,
  createRegistration,
  eventPayload,
  authHeader,
  refreshTokenFor,
};
