const { verifyToken } = require('../utils/jwt');

const authenticate = (req, res, next) => {
    try {
        const token = req.cookies && req.cookies.token;
        console.log('Auth middleware - cookies received:', Object.keys(req.cookies || {}));
        console.log('Auth middleware - token:', token ? 'present' : 'missing');

        if (!token) {
            console.log('Auth failed: No token in cookies');
            return res.status(401).json({ message: 'Access denied. Login required.' });
        }

        const decoded = verifyToken(token);
        console.log('Auth successful for user:', decoded.id);
        req.user = decoded;
        next();
    } catch (error) {
        console.log('Auth error:', error.message);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = { authenticate };
