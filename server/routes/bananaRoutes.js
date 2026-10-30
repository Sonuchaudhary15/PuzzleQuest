/**
 * bananaRoutes.js - Banana API Proxy Endpoints
 * 
 * Endpoints:
 * - GET  /api/banana/challenge : Proxies request to Banana API, returns question image URL & challengeId
 * - POST /api/banana/verify    : Validates player's answer, awards rewards, and prevents duplicate submissions
 */
const express = require('express');
const bananaService = require('../services/bananaService');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/banana/challenge
 */
router.get('/challenge', async (req, res) => {
  const result = await bananaService.requestChallenge();

  if (!result.success) {
    return res.status(503).json({
      error: result.error,
      code: 'EXTERNAL_API_UNAVAILABLE'
    });
  }

  return res.json(result);
});

/**
 * POST /api/banana/verify
 */
router.post('/verify', optionalAuth, async (req, res) => {
  const { challengeId, answer } = req.body;

  if (!challengeId || typeof answer === 'undefined') {
    return res.status(400).json({
      error: 'Both challengeId and answer are required.',
      code: 'MISSING_FIELDS'
    });
  }

  const userId = req.user ? req.user.userId : null;
  const result = await bananaService.verifyAnswer(challengeId, answer, userId);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

module.exports = router;
