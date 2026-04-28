const express = require('express');
const path = require('path');

const app = express();
const FRONTEND_PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

app.listen(FRONTEND_PORT, () => {
    console.log(`Frontend running on http://localhost:${FRONTEND_PORT}`);
});
