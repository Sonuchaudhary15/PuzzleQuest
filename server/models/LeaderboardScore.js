/**
 * LeaderboardScore.js - Mongoose Schema for Fast High-Score Rankings
 */
const mongoose = require('mongoose');

const leaderboardScoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  adventurerTitle: {
    type: String,
    default: 'Crystal Seeker'
  },
  totalScore: {
    type: Number,
    required: true,
    index: true
  },
  totalStars: {
    type: Number,
    default: 0
  },
  levelsCleared: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

leaderboardScoreSchema.index({ totalScore: -1 });

module.exports = mongoose.models.LeaderboardScore || mongoose.model('LeaderboardScore', leaderboardScoreSchema);
