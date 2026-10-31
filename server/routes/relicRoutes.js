/**
 * relicRoutes.js - Relic Crafting & Inventory Persistence Endpoints
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const RelicInventory = require('../models/RelicInventory');
const bananaService = require('../services/bananaService');
const { memoryStore, isUsingMemoryStore } = require('../config/db');

const router = express.Router();

const RECIPES = {
  row_clear: { cost: 30, name: 'Sunbeam Lance' },
  barrier_breaker: { cost: 40, name: 'Rune Breaker' },
  echo_amplifier: { cost: 35, name: 'Resonance Chalice' },
  crystal_burst: { cost: 25, name: 'Astral Bomb' }
};

/**
 * GET /api/relics/inventory
 */
router.get('/inventory', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];
    let user;

    if (isUsingMemoryStore()) {
      user = await memoryStore.findUserById(userId);
      const forgeCount = (user && user.dailyForgeDate === today) ? (user.dailyForgeCount || 0) : 0;
      return res.json({
        fragments: user ? user.relicFragments : 50,
        dailyForgeCount: forgeCount,
        dailyFusesRemaining: Math.max(0, 2 - forgeCount),
        inventory: user?.inventory || { row_clear: 1, barrier_breaker: 1, echo_amplifier: 1, crystal_burst: 1 }
      });
    }

    user = await User.findById(userId);
    let inv = await RelicInventory.findOne({ userId });
    if (!inv) {
      inv = new RelicInventory({ userId });
      await inv.save();
    }

    const forgeCount = (user && user.dailyForgeDate === today) ? (user.dailyForgeCount || 0) : 0;

    return res.json({
      fragments: user ? user.relicFragments : 0,
      dailyForgeCount: forgeCount,
      dailyFusesRemaining: Math.max(0, 2 - forgeCount),
      inventory: {
        row_clear: inv.row_clear,
        barrier_breaker: inv.barrier_breaker,
        echo_amplifier: inv.echo_amplifier,
        crystal_burst: inv.crystal_burst
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error retrieving inventory.' });
  }
});

/**
 * POST /api/relics/forge-trial
 * Solves Banana API Mystery equation to fuse a relic.
 * Strictly limited to 2 relic fusions per day!
 */
router.post('/forge-trial', authMiddleware, async (req, res) => {
  try {
    const { relicType, challengeId, answer } = req.body;
    const recipe = RECIPES[relicType];

    if (!recipe) {
      return res.status(400).json({ error: 'Invalid relic blueprint requested for fusion.' });
    }

    if (!challengeId || typeof answer === 'undefined') {
      return res.status(400).json({ error: 'Challenge ID and answer are required to ignite the forge.' });
    }

    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    // Check daily limit (2 per day)
    let user;
    if (isUsingMemoryStore()) {
      user = await memoryStore.findUserById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'Adventurer identity not found.' });
    }

    if (user.dailyForgeDate !== today) {
      user.dailyForgeDate = today;
      user.dailyForgeCount = 0;
    }

    if ((user.dailyForgeCount || 0) >= 2) {
      return res.status(400).json({
        error: 'Daily Forge limit reached. You can only fuse 2 relics via the Arcane Forge per day! Resets tomorrow.',
        dailyFusesRemaining: 0,
        dailyForgeCount: user.dailyForgeCount
      });
    }

    // Verify Banana API solution securely
    const verifyResult = await bananaService.verifyAnswer(challengeId, answer, userId);

    if (!verifyResult.success || !verifyResult.isCorrect) {
      return res.status(400).json({
        success: false,
        isCorrect: false,
        error: verifyResult.error || 'The arcane solution was incorrect. The forge failed to fuse the relic. Try again!'
      });
    }

    // Success! Increment daily count and grant relic into inventory
    user.dailyForgeCount = (user.dailyForgeCount || 0) + 1;
    if (!isUsingMemoryStore()) {
      await user.save();
    }

    let invData = { row_clear: 1, barrier_breaker: 1, echo_amplifier: 1, crystal_burst: 1 };
    if (!isUsingMemoryStore()) {
      let inv = await RelicInventory.findOne({ userId });
      if (!inv) inv = new RelicInventory({ userId });
      inv[relicType] = (inv[relicType] || 0) + 1;
      inv.updatedAt = new Date();
      await inv.save();
      invData = {
        row_clear: inv.row_clear,
        barrier_breaker: inv.barrier_breaker,
        echo_amplifier: inv.echo_amplifier,
        crystal_burst: inv.crystal_burst
      };
    } else {
      user.inventory = user.inventory || { row_clear: 1, barrier_breaker: 1, echo_amplifier: 1, crystal_burst: 1 };
      user.inventory[relicType] = (user.inventory[relicType] || 0) + 1;
      invData = user.inventory;
    }

    const remainingToday = Math.max(0, 2 - user.dailyForgeCount);

    return res.json({
      success: true,
      isCorrect: true,
      message: `🎉 Arcane Fusion Complete! You deciphered the equation and successfully fused 1x ${recipe.name}!`,
      relicType,
      relicName: recipe.name,
      dailyForgeCount: user.dailyForgeCount,
      dailyFusesRemaining: remainingToday,
      inventory: invData,
      fragments: user.relicFragments
    });
  } catch (err) {
    console.error('[Forge Trial Error]', err);
    return res.status(500).json({ error: 'Server error during Arcane Forge Trial.' });
  }
});

/**
 * POST /api/relics/craft
 * Validates fragment cost and crafts relic
 */
router.post('/craft', authMiddleware, async (req, res) => {
  try {
    const { relicType } = req.body;
    const recipe = RECIPES[relicType];

    if (!recipe) {
      return res.status(400).json({ error: 'Invalid relic type requested.' });
    }

    const userId = req.user.userId;

    if (isUsingMemoryStore()) {
      const user = await memoryStore.findUserById(userId);
      if (!user || (user.relicFragments || 0) < recipe.cost) {
        return res.status(400).json({
          error: `Insufficient fragments. Need ${recipe.cost}, have ${user?.relicFragments || 0}.`
        });
      }
      user.relicFragments -= recipe.cost;
      return res.json({
        message: `Successfully forged ${recipe.name}!`,
        fragments: user.relicFragments,
        relicType,
        inventory: { [relicType]: 2 }
      });
    }

    // Database flow
    const user = await User.findById(userId);
    if (!user || user.relicFragments < recipe.cost) {
      return res.status(400).json({
        error: `Insufficient fragments. Need ${recipe.cost}, have ${user ? user.relicFragments : 0}.`
      });
    }

    user.relicFragments -= recipe.cost;
    await user.save();

    let inv = await RelicInventory.findOne({ userId });
    if (!inv) {
      inv = new RelicInventory({ userId });
    }
    inv[relicType] = (inv[relicType] || 0) + 1;
    inv.updatedAt = new Date();
    await inv.save();

    return res.json({
      message: `Successfully forged ${recipe.name}!`,
      fragments: user.relicFragments,
      relicType,
      inventory: {
        row_clear: inv.row_clear,
        barrier_breaker: inv.barrier_breaker,
        echo_amplifier: inv.echo_amplifier,
        crystal_burst: inv.crystal_burst
      }
    });
  } catch (err) {
    console.error('[Relic Craft Error]', err);
    return res.status(500).json({ error: 'Server error during relic crafting.' });
  }
});

module.exports = router;
