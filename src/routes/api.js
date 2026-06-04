'use strict';

const express = require('express');
const { HttpError } = require('../middleware');
const { calculator } = require('../services/calculator');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    service: 'ci-cd-demo-app',
    api: 'v1',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

router.get('/echo/:value', (req, res) => {
  const { value } = req.params;
  if (!value || value.length > 256) {
    throw new HttpError(400, 'Invalid value parameter');
  }
  res.json({ echoed: value, length: value.length });
});

router.post('/calc', (req, res) => {
  const { operation, a, b } = req.body || {};
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new HttpError(400, 'Both "a" and "b" must be numbers');
  }
  if (!['add', 'subtract', 'multiply', 'divide'].includes(operation)) {
    throw new HttpError(400, 'Invalid operation. Must be add|subtract|multiply|divide');
  }
  const result = calculator(operation, a, b);
  res.json({ operation, a, b, result });
});

module.exports = router;
