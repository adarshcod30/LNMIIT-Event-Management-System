// ================================================================
// lib/sanitize.js: turning untrusted values into safe output
// ================================================================

/** Escape a string so it matches literally inside a RegExp. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A spreadsheet runs a cell as a formula when it starts with one of these
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell: always quoted, quotes doubled, and a leading apostrophe on
 * anything a spreadsheet would run as a formula (CSV injection).
 */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const csvRow = (cells) => cells.map(csvCell).join(',');

/** Escape a TEXT value for an iCalendar file (RFC 5545 section 3.3.11). */
function icsText(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/** A value that is safe inside a Content-Disposition filename. */
function safeFilename(name, extension) {
  const base = String(name || '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 80);
  return `${base || 'download'}${extension}`;
}

// Keys that would change an object's prototype instead of adding a field
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Copy only the listed keys that are present on the source object. */
function pickFields(source, allowed) {
  const picked = {};
  if (!source || typeof source !== 'object') return picked;
  for (const key of allowed) {
    if (UNSAFE_KEYS.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return picked;
}

/** Shorten text to fit a field with a length limit. */
const truncate = (text, max) => (String(text).length > max ? `${String(text).slice(0, max - 1)}…` : String(text));

module.exports = { escapeRegex, csvCell, csvRow, icsText, safeFilename, pickFields, truncate };
