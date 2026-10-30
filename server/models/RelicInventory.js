/**
 * RelicInventory.js - Mongoose Schema for Crafted Battle Relics
 * 
 * Persists each player's tactical relic inventory:
 * Sunbeam Lance (row_clear), Rune Breaker (barrier_breaker),
 * Resonance Chalice (echo_amplifier), Astral Bomb (crystal_burst).
 */
const mongoose = require('mongoose');

const relicInventorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  row_clear: {
    type: Number,
    default: 1
  },
  barrier_breaker: {
    type: Number,
    default: 1
  },
  echo_amplifier: {
    type: Number,
    default: 1
  },
  crystal_burst: {
    type: Number,
    default: 1
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.RelicInventory || mongoose.model('RelicInventory', relicInventorySchema);
