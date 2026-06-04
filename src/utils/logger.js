'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const ACTIVE_LEVEL = process.env.LOG_LEVEL || 'info';

function shouldLog(level) {
  return (LEVELS[level] || 0) <= (LEVELS[ACTIVE_LEVEL] || LEVELS.info);
}

function format(level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && typeof meta === 'object' ? meta : {}),
  };
  return JSON.stringify(entry);
}

function emit(level, message, meta) {
  if (!shouldLog(level)) return;
  const line = format(level, message, meta);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
  child: (bindings) => ({
    error: (msg, meta) => emit('error', msg, { ...bindings, ...meta }),
    warn: (msg, meta) => emit('warn', msg, { ...bindings, ...meta }),
    info: (msg, meta) => emit('info', msg, { ...bindings, ...meta }),
    debug: (msg, meta) => emit('debug', msg, { ...bindings, ...meta }),
  }),
};

module.exports = { logger };
