'use strict';

const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      contentLength: res.get('content-length') || 0,
    });
  });
  next();
}

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  logger.error('request_error', {
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
    stack: isProd ? undefined : err.stack,
  });

  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: status >= 500 && isProd ? 'An internal error occurred' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
}

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

module.exports = { requestLogger, notFoundHandler, errorHandler, HttpError };
