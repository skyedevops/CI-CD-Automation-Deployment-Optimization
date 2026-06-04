'use strict';

const request = require('supertest');
const { createApp } = require('../../src/server');

describe('API Integration', () => {
  let app;
  beforeAll(() => {
    app = createApp({ env: 'test' });
  });

  describe('GET /', () => {
    test('returns application metadata', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('environment', 'test');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  describe('GET /health', () => {
    test('returns health status', async () => {
      const res = await request(app).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
    });

    test('liveness probe returns 200', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
    });

    test('readiness probe returns 200', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/status', () => {
    test('returns service status', async () => {
      const res = await request(app).get('/api/v1/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('operational');
      expect(res.body.api).toBe('v1');
    });
  });

  describe('GET /api/v1/echo/:value', () => {
    test('echoes a value back', async () => {
      const res = await request(app).get('/api/v1/echo/hello');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ echoed: 'hello', length: 5 });
    });

    test('returns 400 for too-long value', async () => {
      const long = 'a'.repeat(300);
      const res = await request(app).get(`/api/v1/echo/${long}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/calc', () => {
    test('adds two numbers', async () => {
      const res = await request(app).post('/api/v1/calc').send({ operation: 'add', a: 2, b: 3 });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(5);
    });

    test('divides two numbers', async () => {
      const res = await request(app)
        .post('/api/v1/calc')
        .send({ operation: 'divide', a: 10, b: 2 });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe(5);
    });

    test('returns 400 on non-numeric input', async () => {
      const res = await request(app)
        .post('/api/v1/calc')
        .send({ operation: 'add', a: 'foo', b: 3 });
      expect(res.status).toBe(400);
    });

    test('returns 400 on unknown operation', async () => {
      const res = await request(app).post('/api/v1/calc').send({ operation: 'modulo', a: 5, b: 3 });
      expect(res.status).toBe(400);
    });
  });

  describe('404 handler', () => {
    test('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/this/does/not/exist');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('Security headers', () => {
    test('sets helmet security headers', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    test('removes x-powered-by header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
