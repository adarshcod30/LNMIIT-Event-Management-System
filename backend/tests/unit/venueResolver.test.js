const {
  resolveVenue,
  getAllVenues,
  getVenueByCanonical,
  searchVenues,
  normalize,
  VENUE_DATABASE,
} = require('../../lib/venueResolver');

describe('normalize', () => {
  it.each([
    ['  LT--1_ ', 'lt1'],
    ['Lecture   Hall #5!', 'lecture hall 5'],
    ['SAC Gym', 'sac gym'],
  ])('%j becomes %j', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });

  it.each([[null], [undefined], ['']])('turns %p into an empty string', (input) => {
    expect(normalize(input)).toBe('');
  });
});

describe('resolveVenue: exact and alias matches', () => {
  it.each([
    ['LT-1', 'LT-1', 'exact'],
    ['lt1', 'LT-1', 'exact'],
    ['lt_1', 'LT-1', 'exact'],
    ['LT 1', 'LT-1', 'alias'],
    ['Lecture Hall 12', 'LT-12', 'alias'],
    ['lecture THEATER 7', 'LT-7', 'alias'],
    ['LH5', 'LT-5', 'alias'],
    ['seminar hall 1', 'Seminar Hall 1', 'exact'],
    ['Computer Lab 1', 'Computer Lab 1', 'exact'],
  ])('%j resolves to %s (%s)', (input, canonical, matchType) => {
    expect(resolveVenue(input)).toMatchObject({ resolved: true, canonical, matchType });
  });

  it('knows every lecture theatre from 1 to 19 under its common spellings', () => {
    for (let n = 1; n <= 19; n += 1) {
      for (const spelling of [`LT-${n}`, `lt${n}`, `LT ${n}`, `Lecture Hall ${n}`, `lecture theatre ${n}`]) {
        expect(resolveVenue(spelling).canonical).toBe(`LT-${n}`);
      }
    }
  });

  it('returns the venue record, with its capacity', () => {
    const result = resolveVenue('LT-3');
    expect(result.venue).toMatchObject({ canonical: 'LT-3', category: 'lecture_theatre', capacity: 120 });
  });
});

describe('resolveVenue: fuzzy matching', () => {
  it('asks the user to choose when a typo is close to several venues', () => {
    const result = resolveVenue('Semnar Hall 1');
    expect(result.resolved).toBe(false);
    expect(result.ambiguous).toBe(true);
    expect(result.suggestions.map((s) => s.canonical)).toEqual(expect.arrayContaining(['Seminar Hall 1', 'Seminar Hall 2']));
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
    expect(result.suggestions[0]).toEqual({
      canonical: expect.any(String),
      category: expect.any(String),
      capacity: expect.any(Number),
      distance: expect.any(Number),
    });
  });

  it('lists the closest suggestions first', () => {
    const { suggestions } = resolveVenue('Semnar Hall 1');
    const distances = suggestions.map((s) => s.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('does not guess a venue for a short string that is merely close to a short alias', () => {
    // "xyz" is within two edits of any three-letter alias, which proves nothing
    expect(resolveVenue('xyz')).toMatchObject({ resolved: false });
    expect(resolveVenue('qq').resolved).toBe(false);
  });

  it('says so when nothing is close at all', () => {
    const result = resolveVenue('Main Auditorium of the Moon');
    expect(result.resolved).toBe(false);
    expect(result.error).toMatch(/not found/);
  });
});

describe('resolveVenue: bad input', () => {
  it.each([[''], ['   '], [null], [undefined], [42], [{}], [['LT-1']]])('refuses %p', (input) => {
    expect(resolveVenue(input)).toEqual({ resolved: false, error: 'Venue name is required' });
  });
});

describe('venue lookups', () => {
  it('filters by category and finds one venue by canonical name', () => {
    const labs = getAllVenues('lab');
    expect(labs.length).toBeGreaterThan(0);
    expect(labs.every((v) => v.category === 'lab')).toBe(true);
    expect(getAllVenues()).toBe(VENUE_DATABASE);
    expect(getVenueByCanonical('LT-3').capacity).toBe(120);
    expect(getVenueByCanonical('LT-15').capacity).toBe(90);
    expect(getVenueByCanonical('nope')).toBeNull();
  });

  it('searches by partial name through canonical names and aliases', () => {
    expect(searchVenues('seminar').map((v) => v.canonical)).toEqual(['Seminar Hall 1', 'Seminar Hall 2']);
    expect(searchVenues('lecture hall 4').map((v) => v.canonical)).toContain('LT-4');
    expect(searchVenues('definitely not a venue')).toEqual([]);
  });

  it('has unique canonical names and a numeric capacity everywhere (0 means not bookable)', () => {
    const names = VENUE_DATABASE.map((v) => v.canonical);
    expect(new Set(names).size).toBe(names.length);
    expect(VENUE_DATABASE.every((v) => Number.isInteger(v.capacity) && v.capacity >= 0)).toBe(true);
  });

  it('never has two venues claiming the same alias, which would make resolution depend on order', () => {
    const owner = new Map();
    for (const venue of VENUE_DATABASE) {
      for (const alias of venue.aliases) {
        const key = normalize(alias);
        if (owner.has(key)) expect({ alias, claimedBy: [owner.get(key), venue.canonical] }).toEqual({ alias, claimedBy: [venue.canonical, venue.canonical] });
        owner.set(key, venue.canonical);
      }
    }
  });
});
