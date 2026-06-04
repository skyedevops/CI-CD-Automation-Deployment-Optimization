'use strict';

const { healthCheck, getMemoryUsageMB, getCpuUsage } = require('../../src/utils/health');

describe('Health Utility', () => {
  describe('getMemoryUsageMB()', () => {
    test('returns memory stats as MB numbers', () => {
      const mem = getMemoryUsageMB();
      expect(mem).toHaveProperty('rss');
      expect(mem).toHaveProperty('heapTotal');
      expect(mem).toHaveProperty('heapUsed');
      expect(mem).toHaveProperty('external');
      Object.values(mem).forEach((v) => expect(typeof v).toBe('number'));
    });
  });

  describe('getCpuUsage()', () => {
    test('returns CPU stats with cores and load average', () => {
      const cpu = getCpuUsage();
      expect(cpu.cores).toBeGreaterThan(0);
      expect(Array.isArray(cpu.loadAvg)).toBe(true);
      expect(cpu.loadAvg).toHaveLength(3);
    });
  });

  describe('healthCheck() handler', () => {
    let handler;
    beforeAll(() => {
      handler = healthCheck();
    });

    function mockRes() {
      return {
        statusCode: 200,
        headers: {},
        body: null,
        status(c) {
          this.statusCode = c;
          return this;
        },
        set(k, v) {
          this.headers[k] = v;
          return this;
        },
        json(b) {
          this.body = b;
          return this;
        },
      };
    }

    test('responds with full status on /health', () => {
      const req = { path: '/health' };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('memory');
      expect(res.body).toHaveProperty('cpu');
    });

    test('responds alive on /health/live', () => {
      const req = { path: '/health/live' };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('alive');
    });

    test('responds ready on /health/ready', () => {
      const req = { path: '/health/ready' };
      const res = mockRes();
      handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ready');
    });
  });
});
