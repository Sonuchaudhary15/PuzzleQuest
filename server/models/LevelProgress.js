/**
 * LevelProgress.js - Mongoose Schema for Adventure Level Mastery
 * 
 * Tracks player scores, star ratings (1-3), and completion status per level.
 */
const mongoose = require('mongoose');

const levelProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  levelId: {
    type: Number,
    required: true
  },
  highScore: {
    type: Number,
    default: 0
  },
  stars: {
    type: Number,
    min: 1,
    max: 3,
    default: 1
  },
  completed: {
    type: Boolean,
    default: true
  },
  clearedAt: {
    type: Date,
    default: Date.now
  }
});

levelProgressSchema.index({ userId: 1, levelId: 1 }, { unique: true });

module.exports = mongoose.models.LevelProgress || mongoose.model('LevelProgress', levelProgressSchema);
