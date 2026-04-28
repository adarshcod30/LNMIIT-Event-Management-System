const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb+srv://23ucs509_db_user:FKjf26IU4npVWWGJ@cluster0.lfa618p.mongodb.net/lnmiit_events?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URL);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
