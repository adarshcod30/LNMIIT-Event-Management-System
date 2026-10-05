const { checkVenueConflict, checkEventConflicts, checkAllRoundsConflicts } = require('../../lib/conflictChecker');
const { createUser, createEvent, DAY, HOUR } = require('../helpers/factories');

const at = (days, hour) => new Date(Date.now() + days * DAY + hour * HOUR - ((Date.now() + days * DAY + hour * HOUR) % HOUR));
const round = (name, venue, start, end) => ({
  roundName: name,
  canonicalVenue: venue,
  roundVenue: venue,
  roundStartDateTime: start,
  roundEndDateTime: end,
});

describe('checkVenueConflict', () => {
  let organizer;
  beforeEach(async () => {
    organizer = await createUser('faculty');
  });

  it.each([
    ['starts inside the existing slot', [1, 3], true],
    ['ends inside the existing slot', [-1, 1], true],
    ['fully contains the existing slot', [-1, 5], true],
    ['sits fully inside the existing slot', [0.5, 1.5], true],
    ['has identical times', [0, 2], true],
    ['starts exactly when the existing one ends', [2, 4], false],
    ['ends exactly when the existing one starts', [-2, 0], false],
    ['is well before', [-10, -8], false],
    ['is well after', [10, 12], false],
  ])('a booking that %s', async (_label, [fromHour, toHour], expected) => {
    const base = at(5, 9);
    await createEvent(organizer, {
      canonicalVenue: 'LT-1',
      startDateTime: base,
      endDateTime: new Date(base.getTime() + 2 * HOUR),
    });

    const result = await checkVenueConflict({
      venue: 'LT-1',
      startDateTime: new Date(base.getTime() + fromHour * HOUR),
      endDateTime: new Date(base.getTime() + toHour * HOUR),
    });
    expect(result.hasConflict).toBe(expected);
  });

  it('can exclude the event being edited so it does not conflict with itself', async () => {
    const event = await createEvent(organizer, { canonicalVenue: 'LT-1' });
    const args = { venue: 'LT-1', startDateTime: event.startDateTime, endDateTime: event.endDateTime };

    expect((await checkVenueConflict(args)).hasConflict).toBe(true);
    expect((await checkVenueConflict({ ...args, excludeEventId: event._id })).hasConflict).toBe(false);
  });

  it('reports who holds the clashing slot', async () => {
    const event = await createEvent(organizer, { canonicalVenue: 'LT-1', title: 'Robotics Demo' });
    const { conflicts } = await checkVenueConflict({
      venue: 'LT-1',
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
    });
    expect(conflicts[0]).toMatchObject({
      title: 'Robotics Demo',
      venue: 'LT-1',
      organizer: { email: organizer.email },
    });
  });
});

describe('rounds', () => {
  let organizer;
  beforeEach(async () => {
    organizer = await createUser('faculty');
  });

  it('only conflicts when the same round is at the same venue at the same time', async () => {
    // Prelims in LT-1 on day 5, finals in LT-2 on day 6.
    const day5 = at(5, 9);
    const day6 = at(6, 9);
    await createEvent(organizer, {
      title: 'Two-day contest',
      canonicalVenue: 'Seminar Hall 1',
      startDateTime: at(5, 8),
      endDateTime: at(6, 12),
      rounds: [
        round('Prelims', 'LT-1', day5, new Date(day5.getTime() + HOUR)),
        round('Finals', 'LT-2', day6, new Date(day6.getTime() + HOUR)),
      ],
    });

    // LT-1 is free on day 6, so booking it then must not be flagged
    const free = await checkVenueConflict({
      venue: 'LT-1',
      startDateTime: day6,
      endDateTime: new Date(day6.getTime() + HOUR),
    });
    expect(free.hasConflict).toBe(false);

    // LT-1 really is taken on day 5
    const taken = await checkVenueConflict({
      venue: 'LT-1',
      startDateTime: day5,
      endDateTime: new Date(day5.getTime() + HOUR),
    });
    expect(taken.hasConflict).toBe(true);
  });

  it('checks every round of a new event separately', async () => {
    const day5 = at(5, 9);
    await createEvent(organizer, {
      canonicalVenue: 'LT-1',
      startDateTime: day5,
      endDateTime: new Date(day5.getTime() + 2 * HOUR),
    });

    const conflicts = await checkAllRoundsConflicts([
      round('Qualifier', 'LT-1', day5, new Date(day5.getTime() + HOUR)),
      round('Semi', 'LT-2', day5, new Date(day5.getTime() + HOUR)),
      { roundName: 'Incomplete', roundStartDateTime: day5 },
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ roundName: 'Qualifier', venue: 'LT-1' });
  });
});

describe('checkEventConflicts', () => {
  it('combines the main venue and the rounds into one verdict', async () => {
    const organizer = await createUser('faculty');
    const day5 = at(5, 9);
    await createEvent(organizer, { canonicalVenue: 'LT-1', startDateTime: day5, endDateTime: new Date(day5.getTime() + 2 * HOUR) });

    const clean = await checkEventConflicts({
      canonicalVenue: 'LT-3',
      startDateTime: day5,
      endDateTime: new Date(day5.getTime() + HOUR),
    });
    expect(clean).toMatchObject({ hasAnyConflict: false, primaryConflict: { hasConflict: false }, roundConflicts: [] });

    const viaRound = await checkEventConflicts({
      canonicalVenue: 'LT-3',
      startDateTime: day5,
      endDateTime: new Date(day5.getTime() + HOUR),
      rounds: [round('Final', 'LT-1', day5, new Date(day5.getTime() + HOUR))],
    });
    expect(viaRound.hasAnyConflict).toBe(true);
    expect(viaRound.primaryConflict.hasConflict).toBe(false);
  });

  it('has nothing to say about an event with no venue or times yet', async () => {
    expect(await checkEventConflicts({})).toEqual({ primaryConflict: null, roundConflicts: [], hasAnyConflict: false });
  });
});
