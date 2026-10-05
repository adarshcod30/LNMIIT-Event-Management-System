// ================================================================
// models/Team.js: Team Model
// ================================================================
// Teams exist within the context of a specific event.
// The captain creates the team and invites members.
// Teams have min/max size constraints from the event config.
// ================================================================

const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  invitedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
}, { _id: true });

const teamSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: 100,
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    invites: [inviteSchema],
    status: {
      type: String,
      enum: ['incomplete', 'complete', 'registered', 'disqualified'],
      default: 'incomplete',
    },
    // Scores per round for leaderboard
    scores: [{
      roundName: String,
      score: Number,
      rank: Number,
    }],
    totalScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ---- Indexes ----
teamSchema.index({ event: 1 });
teamSchema.index({ captain: 1 });
teamSchema.index({ event: 1, name: 1 }, { unique: true }); // Unique team name per event

module.exports = mongoose.model('Team', teamSchema);
