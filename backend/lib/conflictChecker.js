// ================================================================
// lib/conflictChecker.js: Event Venue & Time Conflict Detection
// ================================================================
// Checks if a proposed event/round conflicts with any existing
// approved or ongoing events. Two events conflict if they share
// the same canonical venue AND their time windows overlap.
//
// Overlap formula: newStart < existingEnd AND newEnd > existingStart
// ================================================================

const Event = require('../models/Event');

/**
 * Check for venue/time conflicts for a proposed event.
 * 
 * @param {Object} params
 * @param {string} params.venue - Canonical venue name
 * @param {Date} params.startDateTime - Proposed start time
 * @param {Date} params.endDateTime - Proposed end time
 * @param {string} [params.excludeEventId] - Event ID to exclude (for updates)
 * @returns {Object} { hasConflict: boolean, conflicts: Array }
 */
async function checkVenueConflict({ venue, startDateTime, endDateTime, excludeEventId = null }) {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  // Build query: find events at the same venue with overlapping time
  const query = {
    status: { $in: ['approved', 'ongoing'] },
    $or: [
      // Check primary venue conflict
      {
        canonicalVenue: venue,
        startDateTime: { $lt: end },   // existing starts before new ends
        endDateTime: { $gt: start },   // existing ends after new starts
      },
      // Check round venue conflicts. $elemMatch makes the venue and the times
      // apply to the SAME round; without it Mongo matches the venue on one
      // round and the times on another and reports a clash that does not exist.
      {
        rounds: {
          $elemMatch: {
            canonicalVenue: venue,
            roundStartDateTime: { $lt: end },
            roundEndDateTime: { $gt: start },
          },
        },
      },
    ],
  };

  // Exclude current event (useful when updating an existing event)
  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }

  const conflictingEvents = await Event.find(query)
    .select('title canonicalVenue startDateTime endDateTime organizer rounds status')
    .populate('organizer', 'name email role')
    .lean();

  if (conflictingEvents.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  // Format conflict details for clear error messages
  const conflicts = conflictingEvents.map(event => ({
    eventId: event._id,
    title: event.title,
    venue: event.canonicalVenue,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    organizer: event.organizer ? { name: event.organizer.name, email: event.organizer.email } : null,
    status: event.status,
  }));

  return { hasConflict: true, conflicts };
}

/**
 * Check conflicts for all rounds of an event.
 * Returns conflicts for each round separately.
 */
async function checkAllRoundsConflicts(rounds, excludeEventId = null) {
  const allConflicts = [];

  for (const round of rounds) {
    if (!round.canonicalVenue || !round.roundStartDateTime || !round.roundEndDateTime) continue;

    const result = await checkVenueConflict({
      venue: round.canonicalVenue,
      startDateTime: round.roundStartDateTime,
      endDateTime: round.roundEndDateTime,
      excludeEventId,
    });

    if (result.hasConflict) {
      allConflicts.push({
        roundName: round.roundName,
        venue: round.canonicalVenue,
        conflicts: result.conflicts,
      });
    }
  }

  return allConflicts;
}

/**
 * Full conflict check for an event (primary venue + all rounds).
 */
async function checkEventConflicts(eventData, excludeEventId = null) {
  const results = {
    primaryConflict: null,
    roundConflicts: [],
    hasAnyConflict: false,
  };

  // Check primary venue
  if (eventData.canonicalVenue && eventData.startDateTime && eventData.endDateTime) {
    const primaryResult = await checkVenueConflict({
      venue: eventData.canonicalVenue,
      startDateTime: eventData.startDateTime,
      endDateTime: eventData.endDateTime,
      excludeEventId,
    });
    results.primaryConflict = primaryResult;
    if (primaryResult.hasConflict) {
      results.hasAnyConflict = true;
    }
  }

  // Check all rounds
  if (eventData.rounds && eventData.rounds.length > 0) {
    results.roundConflicts = await checkAllRoundsConflicts(eventData.rounds, excludeEventId);
    if (results.roundConflicts.length > 0) {
      results.hasAnyConflict = true;
    }
  }

  return results;
}

module.exports = {
  checkVenueConflict,
  checkAllRoundsConflicts,
  checkEventConflicts,
};
