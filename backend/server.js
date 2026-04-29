const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./config/db');

const userRoutes = require('./modules/users/userRoutes');
const scheduleRoutes = require('./modules/schedules/scheduleRoutes');

const app = express();
const BACKEND_PORT = 4000;

// For cookie auth, do not use '*' origin. Reflect requesting origin instead.
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests without an Origin header (like curl/Postman).
        if (!origin) {
            return callback(null, true);
        }
        return callback(null, origin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.json());
app.use(cookieParser());

// Serve static frontend files (CSS, JS)
app.use('/css', express.static(path.join(__dirname, '../frontend/public/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/public/js')));

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Origin:', req.get('origin'));
    console.log('Cookies:', req.cookies);
    next();
});

app.get('/api/health', (req, res) => {
    res.json({ message: 'Backend is running.' });
});

app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);

// Serve HTML pages (after API routes)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/views/login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/views/dashboard.html'));
});

connectDB().then(() => {
    app.listen(BACKEND_PORT, () => {
        console.log(`Backend running on http://localhost:${BACKEND_PORT}`);
    });
});
