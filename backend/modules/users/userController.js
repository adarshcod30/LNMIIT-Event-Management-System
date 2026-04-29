const bcrypt = require('bcryptjs');
const User = require('./userModel');
const { generateToken } = require('../../utils/jwt');

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();

        if (!name || !cleanEmail || !password) {
            return res.status(400).json({ message: 'Name, email and password are required.' });
        }

        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({ name, email: cleanEmail, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: 'Registration successful!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = String(email || '').trim().toLowerCase();

        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const token = generateToken(user);

        // Simple cookie settings - same-origin eliminates cross-port issues
        res.cookie('token', token, {
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        });

        console.log('Cookie set for user:', user._id);
        res.json({
            message: 'Login successful!',
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const logout = (req, res) => {
    res.clearCookie('token', {
        path: '/'
    });

    res.json({ message: 'Logged out successfully.' });
};

const me = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

module.exports = { register, login, logout, me };
