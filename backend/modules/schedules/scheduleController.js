const Schedule = require('./scheduleModel');

const createSchedule = async (req, res) => {
    try {
        const { eventName, roundName, roundNumber, date, startTime, endTime, venue } = req.body;

        if (!eventName || !roundName || !roundNumber || !date || !startTime || !endTime || !venue) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const schedule = new Schedule({
            eventName,
            roundName,
            roundNumber,
            date,
            startTime,
            endTime,
            venue,
            status: req.body.status || 'scheduled'
        });
        await schedule.save();

        res.status(201).json({ message: 'Schedule created!', schedule });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const getAllSchedules = async (req, res) => {
    try {
        const schedules = await Schedule.find()
            .sort({ date: 1, roundNumber: 1 });
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const updateSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found.' });
        }
        res.json({ message: 'Schedule updated!', schedule });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

const deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findByIdAndDelete(req.params.id);
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found.' });
        }
        res.json({ message: 'Schedule deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

module.exports = { createSchedule, getAllSchedules, updateSchedule, deleteSchedule };
