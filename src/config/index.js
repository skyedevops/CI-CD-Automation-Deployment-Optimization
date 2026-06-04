'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'combined',
  appVersion: process.env.APP_VERSION || readPackageVersion(),
  gitSha: process.env.GIT_SHA || 'unknown',
  buildDate: process.env.BUILD_DATE || new Date().toISOString(),
  shutdownTimeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000,
};

function readPackageVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch (_) {
    return '0.0.0';
  }
}

function getConfig(overrides = {}) {
  return { ...DEFAULTS, ...overrides };
}

module.exports = { getConfig, DEFAULTS };
