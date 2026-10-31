/**
 * User.js - Mongoose Schema for Player Accounts & Virtual Identity
 * 
 * Stores authentication credentials (hashed passwords), player statistics,
 * progression markers, and relic fragments.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [24, 'Username cannot exceed 24 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  adventurerTitle: {
    type: String,
    default: 'Crystal Seeker'
  },
  totalScore: {
    type: Number,
    default: 0
  },
  totalStars: {
    type: Number,
    default: 0
  },
  levelsCleared: {
    type: Number,
    default: 0
  },
  relicFragments: {
    type: Number,
    default: 50 // New adventurer grant
  },
  bananaSolved: {
    type: Number,
    default: 0
  },
  dailyForgeDate: {
    type: String,
    default: ''
  },
  dailyForgeCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index totalScore descending for high-speed leaderboard queries
userSchema.index({ totalScore: -1 });

/**
 * Calculate virtual identity adventurer tier based on accumulated stars
 */
userSchema.methods.getAdventurerTier = function() {
  if (this.totalStars >= 12) return 'Grand Master';
  if (this.totalStars >= 8) return 'Adept Conjurer';
  if (this.totalStars >= 4) return 'Rune Scholar';
  return 'Apprentice Novice';
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
