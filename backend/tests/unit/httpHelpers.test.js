const { parsePagination } = require('../../lib/pagination');
const { isObjectId, validateIdParam } = require('../../lib/objectId');
const { canManageEvent } = require('../../lib/permissions');
const { sendError } = require('../../lib/respond');

describe('parsePagination', () => {
  it.each([
    [{}, { page: 1, limit: 20, skip: 0 }],
    [{ page: '3', limit: '10' }, { page: 3, limit: 10, skip: 20 }],
    [{ page: '0', limit: '0' }, { page: 1, limit: 20, skip: 0 }],
    [{ page: '-4', limit: '-1' }, { page: 1, limit: 20, skip: 0 }],
    [{ page: 'abc', limit: 'xyz' }, { page: 1, limit: 20, skip: 0 }],
    [{ page: '2', limit: '100000' }, { page: 2, limit: 100, skip: 100 }],
    [{ page: '1.9', limit: '5.9' }, { page: 1, limit: 5, skip: 0 }],
    [{ page: ['2'], limit: ['5'] }, { page: 2, limit: 5, skip: 5 }],
  ])('%j gives %j', (query, expected) => {
    expect(parsePagination(query)).toEqual(expected);
  });

  it('honours a route\'s own default and maximum', () => {
    expect(parsePagination({}, { defaultLimit: 12, maxLimit: 50 })).toMatchObject({ limit: 12 });
    expect(parsePagination({ limit: '500' }, { defaultLimit: 12, maxLimit: 50 })).toMatchObject({ limit: 50 });
  });

  it('copes with no query at all', () => {
    expect(parsePagination()).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});

describe('isObjectId', () => {
  it.each([
    ['507f1f77bcf86cd799439011', true],
    ['507F1F77BCF86CD799439011', true],
    ['507f1f77bcf86cd79943901', false],
    ['507f1f77bcf86cd7994390111', false],
    ['zzzzzzzzzzzzzzzzzzzzzzzz', false],
    ['abcdefghijkl', false],
    ['', false],
    [null, false],
    [undefined, false],
    [123, false],
    [{ $ne: null }, false],
  ])('%p is %s', (value, expected) => {
    expect(isObjectId(value)).toBe(expected);
  });
});

describe('validateIdParam', () => {
  const run = (value) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    validateIdParam({}, res, next, value);
    return { res, next };
  };

  it('lets a valid id through', () => {
    const { res, next } = run('507f1f77bcf86cd799439011');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 400 and stops for an invalid one', () => {
    const { res, next } = run('nope');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid id' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('canManageEvent', () => {
  const event = { organizer: 'u1', coOrganizers: ['u2', { _id: 'u3' }] };

  it.each([
    ['the organizer', { _id: 'u1', role: 'faculty' }, true],
    ['a co-organizer', { _id: 'u2', role: 'faculty' }, true],
    ['a populated co-organizer', { _id: 'u3', role: 'student' }, true],
    ['the admin', { _id: 'zz', role: 'admin' }, true],
    ['another faculty member', { _id: 'u9', role: 'faculty' }, false],
    ['a student', { _id: 'u8', role: 'student' }, false],
  ])('%s: %s', (_label, user, expected) => {
    expect(canManageEvent(user, event)).toBe(expected);
  });

  it('understands a populated organizer and an event with no co-organizers', () => {
    expect(canManageEvent({ _id: 'u1', role: 'faculty' }, { organizer: { _id: 'u1' } })).toBe(true);
  });

  it.each([[null, event], [{ _id: 'u1', role: 'faculty' }, null]])('is false when the user or event is missing', (user, ev) => {
    expect(canManageEvent(user, ev)).toBe(false);
  });
});

describe('sendError', () => {
  const makeRes = (log) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), req: log ? { log } : undefined };
    return res;
  };
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it('turns a Mongoose validation error into 400 with every message', () => {
    const res = makeRes();
    sendError(res, { name: 'ValidationError', errors: { a: { message: 'A is required' }, b: { message: 'B is too long' } } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'A is required; B is too long' });
  });

  it('turns a cast error into 400 naming the field', () => {
    const res = makeRes();
    sendError(res, { name: 'CastError', path: 'category' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid value for category' });
  });

  it('answers 500 with the real message while developing, and logs it on the request logger', () => {
    const log = { error: jest.fn() };
    const res = makeRes(log);
    const error = new Error('db exploded');
    sendError(res, error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'db exploded' });
    expect(log.error).toHaveBeenCalledWith({ err: error }, 'request failed');
  });

  it('answers 500 with a generic message in production', () => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    sendError(res, new Error('mongodb://user:secret@host'));
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal server error' });
  });

  it('falls back to the console when there is no request logger', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    sendError(makeRes(), new Error('x'));
    expect(spy).toHaveBeenCalled();
  });
});
