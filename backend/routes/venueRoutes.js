// Venue routes
const express = require('express');
const router = express.Router();
const { resolveVenue, getAllVenues, searchVenues } = require('../lib/venueResolver');

// GET /api/venues: List all venues
router.get('/', (req, res) => {
  const { category } = req.query;
  const venues = getAllVenues(category || null);
  res.json({ success: true, data: venues.map(v => ({ canonical: v.canonical, category: v.category, capacity: v.capacity })) });
});

// POST /api/venues/resolve: Resolve a venue name
router.post('/resolve', (req, res) => {
  const { venue } = req.body;
  if (!venue) return res.status(400).json({ success: false, error: 'Venue name required' });
  const result = resolveVenue(venue);
  res.json({ success: true, data: result });
});

// GET /api/venues/search: Search venues
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query required' });
  const results = searchVenues(q);
  res.json({ success: true, data: results.map(v => ({ canonical: v.canonical, category: v.category, capacity: v.capacity })) });
});

module.exports = router;
