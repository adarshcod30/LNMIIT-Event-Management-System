const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

app.use(cors(corsOptions));
// Explicitly handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.get('/api/health', (req, res) => {
    res.json({ message: 'Backend is running.' });
});

app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);

connectDB().then(() => {
    app.listen(BACKEND_PORT, () => {
        console.log(`Backend running on http://localhost:${BACKEND_PORT}`);
    });
});
