// ================================================================
// lib/permissions.js: who may manage an event
// ================================================================

const idOf = (value) => String((value && value._id) || value);

/** The organizer, a listed co-organizer, or the admin. */
function canManageEvent(user, event) {
  if (!user || !event) return false;
  if (user.role === 'admin') return true;
  if (idOf(event.organizer) === String(user._id)) return true;
  return (event.coOrganizers || []).some((c) => idOf(c) === String(user._id));
}

module.exports = { canManageEvent };
