'use strict';

const os = require('os');
const { getConfig } = require('../config');

function getMemoryUsageMB() {
  const m = process.memoryUsage();
  return {
    rss: Math.round(m.rss / 1024 / 1024),
    heapTotal: Math.round(m.heapTotal / 1024 / 1024),
    heapUsed: Math.round(m.heapUsed / 1024 / 1024),
    external: Math.round(m.external / 1024 / 1024),
  };
}

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  return {
    cores: cpus.length,
    loadAvg: os.loadavg(),
    idlePercent: totalTick > 0 ? Math.round((totalIdle / totalTick) * 100) : 0,
  };
}

function healthCheck() {
  const startedAt = Date.now();
  return (req, res) => {
    const config = getConfig();
    const uptimeSec = Math.floor(process.uptime());
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: uptimeSec,
      version: config.appVersion,
      gitSha: config.gitSha,
      buildDate: config.buildDate,
      environment: config.env,
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: getMemoryUsageMB(),
      cpu: getCpuUsage(),
    };

    const isReady = uptimeSec >= 0 && status.memory.rss < 1024 && status.cpu.idlePercent > 5;

    if (!isReady) {
      status.status = 'degraded';
      return res.status(503).json(status);
    }

    if (req.path === '/health/live' || req.path.endsWith('/live')) {
      return res.status(200).json({ status: 'alive', uptime: uptimeSec });
    }

    if (req.path === '/health/ready' || req.path.endsWith('/ready')) {
      return res.status(200).json({ status: 'ready', uptime: uptimeSec });
    }

    res.set('X-Response-Time-Ms', String(Date.now() - startedAt));
    res.status(200).json(status);
  };
}

module.exports = { healthCheck, getMemoryUsageMB, getCpuUsage };
