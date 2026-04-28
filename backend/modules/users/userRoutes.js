const express = require('express');
const router = express.Router();
const { register, login, logout, me } = require('./userController');
const { authenticate } = require('../../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, me);

module.exports = router;
