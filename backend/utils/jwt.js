const jwt = require('jsonwebtoken');

const JWT_SECRET = 'beginner_project_jwt_secret_2026';

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, name: user.name, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
