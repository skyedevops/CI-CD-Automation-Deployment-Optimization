'use strict';

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const apiRoutes = require('./routes/api');
const { requestLogger, errorHandler, notFoundHandler } = require('./middleware');
const { getConfig } = require('./config');
const { logger } = require('./utils/logger');
const { healthCheck } = require('./utils/health');

function createApp(options = {}) {
  const app = express();
  const config = getConfig(options);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (config.env !== 'test') {
    app.use(morgan(config.logFormat));
    app.use(requestLogger);
  }

  app.use('/health', healthCheck());
  app.use('/api/v1', apiRoutes);
  app.get('/', (req, res) => {
    res.json({
      name: 'ci-cd-demo-app',
      version: config.appVersion,
      environment: config.env,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function startServer(app, options = {}) {
  const config = getConfig(options);
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, (err) => {
      if (err) return reject(err);
      logger.info(`Server listening on http://${config.host}:${config.port} [${config.env}]`);
      resolve(server);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason: String(reason) });
    });
  });
}

module.exports = { createApp, startServer };

if (require.main === module) {
  const app = createApp();
  startServer(app).catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });
}
