/**
 * errorHandler.js - Centralized HTTP Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[Unhandled Server Exception]:', err.stack || err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
