// ================================================================
// lib/objectId.js: reject malformed ids before they reach Mongoose
// ================================================================

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

/** router.param handler: answers 400 for an id that cannot be an ObjectId. */
function validateIdParam(req, res, next, value) {
  if (!isObjectId(value)) {
    return res.status(400).json({ success: false, error: 'Invalid id' });
  }
  return next();
}

module.exports = { isObjectId, validateIdParam };
