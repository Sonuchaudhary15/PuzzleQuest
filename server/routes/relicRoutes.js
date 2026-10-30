/**
 * relicRoutes.js - Relic Crafting & Inventory Persistence Endpoints
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const RelicInventory = require('../models/RelicInventory');
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
    if (isUsingMemoryStore()) {
      return res.json({
        fragments: 50,
        inventory: { row_clear: 1, barrier_breaker: 1, echo_amplifier: 1, crystal_burst: 1 }
      });
    }

    const user = await User.findById(userId);
    let inv = await RelicInventory.findOne({ userId });
    if (!inv) {
      inv = new RelicInventory({ userId });
      await inv.save();
    }

    return res.json({
      fragments: user ? user.relicFragments : 0,
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
