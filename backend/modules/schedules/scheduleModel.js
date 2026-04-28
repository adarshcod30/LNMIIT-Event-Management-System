const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    eventName: {
        type: String,
        required: true
    },
    roundName: {
        type: String,
        required: true
    },
    roundNumber: {
        type: Number,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    venue: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'scheduled'
    }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
