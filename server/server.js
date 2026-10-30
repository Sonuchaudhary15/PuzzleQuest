/**
 * server.js - PuzzleQuest Express Application Entry Point
 * 
 * Orchestrates Express web server, REST API endpoints, MongoDB connection,
 * static frontend assets, and security middleware.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');

// Route modules
const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const relicRoutes = require('./routes/relicRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const bananaRoutes = require('./routes/bananaRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB with in-memory fallback
connectDB();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware: tracks request latency
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  next();
});

// Serve Static Frontend Assets
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Also expose levelDefinitions for client script tag
app.get('/data/levelDefinitions.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'levelDefinitions.js'));
});

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/relics', relicRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/banana', bananaRoutes);

// System Health Check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    game: 'PuzzleQuest: A Strategy-Based Match-Three Adventure',
    timestamp: new Date().toISOString()
  });
});

// Centralized Error Handling
app.use(errorHandler);

// Start HTTP Server
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  PUZZLEQUEST: MATCH-THREE ADVENTURE SERVER ONLINE  `);
  console.log(`  Local URL: http://localhost:${PORT}                `);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'} `);
  console.log(`====================================================`);
});

// Graceful process shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = app;
