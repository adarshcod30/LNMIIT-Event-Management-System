const express = require('express');
const router = express.Router();
const { createSchedule, getAllSchedules, updateSchedule, deleteSchedule } = require('./scheduleController');
const { authenticate } = require('../../middleware/authMiddleware');

router.get('/', authenticate, getAllSchedules);
router.post('/', authenticate, createSchedule);
router.put('/:id', authenticate, updateSchedule);
router.delete('/:id', authenticate, deleteSchedule);

module.exports = router;
