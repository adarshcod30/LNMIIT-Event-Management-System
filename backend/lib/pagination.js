// ================================================================
// lib/pagination.js: bounded page and limit parsing
// ================================================================

/**
 * Turn ?page=&limit= into numbers that are always usable. A client can ask
 * for any limit, but never more than maxLimit, so one request cannot pull a
 * whole collection.
 */
function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(limit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { parsePagination };
