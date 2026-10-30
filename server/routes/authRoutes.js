/**
 * authRoutes.js - Authentication & Player Identity Endpoints
 * 
 * Endpoints:
 * - POST /api/auth/register : Register new player with hashed password
 * - POST /api/auth/login    : Authenticate and issue JWT token
 * - GET  /api/auth/me       : Retrieve authenticated profile, stats, and inventory
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RelicInventory = require('../models/RelicInventory');
const LevelProgress = require('../models/LevelProgress');
const { authMiddleware } = require('../middleware/auth');
const { memoryStore, isUsingMemoryStore } = require('../config/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'puzzlequest_dev_secret_key_change_in_production_9988';

/**
 * Generate JWT Token helper
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, adventurerTitle } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check duplicate
    if (isUsingMemoryStore()) {
      const existing = await memoryStore.findUserByUsername(cleanUsername);
      if (existing) {
        return res.status(409).json({ error: 'Username is already taken by another adventurer.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        _id: `mem_user_${Date.now()}`,
        username: cleanUsername,
        password: hashedPassword,
        adventurerTitle: adventurerTitle || 'Crystal Seeker',
        totalScore: 0,
        totalStars: 0,
        levelsCleared: 0,
        relicFragments: 50,
        createdAt: new Date()
      };

      await memoryStore.saveUser(newUser);
      const token = generateToken(newUser);

      return res.status(201).json({
        message: 'Adventurer identity successfully created!',
        token,
        user: {
          id: newUser._id,
          username: newUser.username,
          adventurerTitle: newUser.adventurerTitle,
          totalScore: newUser.totalScore,
          totalStars: newUser.totalStars,
          levelsCleared: newUser.levelsCleared,
          relicFragments: newUser.relicFragments
        }
      });
    }

    // MongoDB Mongoose flow
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(409).json({ error: 'Username is already taken by another adventurer.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: cleanUsername,
      password: hashedPassword,
      adventurerTitle: adventurerTitle || 'Crystal Seeker',
      relicFragments: 50
    });

    await user.save();

    // Initialize default relic inventory
    const inventory = new RelicInventory({
      userId: user._id,
      row_clear: 1,
      barrier_breaker: 1,
      echo_amplifier: 1,
      crystal_burst: 1
    });
    await inventory.save();

    const token = generateToken(user);

    return res.status(201).json({
      message: 'Adventurer identity successfully created!',
      token,
      user: {
        id: user._id,
        username: user.username,
        adventurerTitle: user.adventurerTitle,
        totalScore: user.totalScore,
        totalStars: user.totalStars,
        levelsCleared: user.levelsCleared,
        relicFragments: user.relicFragments
      }
    });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    let user;
    if (isUsingMemoryStore()) {
      user = await memoryStore.findUserByUsername(cleanUsername);
    } else {
      user = await User.findOne({ username: cleanUsername });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        username: user.username,
        adventurerTitle: user.adventurerTitle,
        totalScore: user.totalScore || 0,
        totalStars: user.totalStars || 0,
        levelsCleared: user.levelsCleared || 0,
        relicFragments: user.relicFragments || 0
      }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    let user;
    let inventory = { row_clear: 1, barrier_breaker: 1, echo_amplifier: 1, crystal_burst: 1 };
    let progress = [];

    if (isUsingMemoryStore()) {
      user = await memoryStore.findUserById(req.user.userId);
    } else {
      user = await User.findById(req.user.userId).select('-password');
      if (user) {
        const invRecord = await RelicInventory.findOne({ userId: user._id });
        if (invRecord) {
          inventory = {
            row_clear: invRecord.row_clear,
            barrier_breaker: invRecord.barrier_breaker,
            echo_amplifier: invRecord.echo_amplifier,
            crystal_burst: invRecord.crystal_burst
          };
        }
        progress = await LevelProgress.find({ userId: user._id });
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'Adventurer profile not found.' });
    }

    return res.json({
      user: {
        id: user._id,
        username: user.username,
        adventurerTitle: user.adventurerTitle,
        totalScore: user.totalScore || 0,
        totalStars: user.totalStars || 0,
        levelsCleared: user.levelsCleared || 0,
        relicFragments: user.relicFragments || 0,
        createdAt: user.createdAt
      },
      inventory,
      progress
    });
  } catch (err) {
    console.error('[Profile Fetch Error]', err);
    return res.status(500).json({ error: 'Server error fetching player profile.' });
  }
});

module.exports = router;
