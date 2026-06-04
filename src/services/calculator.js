'use strict';

const OPERATIONS = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => {
    if (b === 0) {
      const err = new Error('Division by zero');
      err.name = 'DivisionByZeroError';
      throw err;
    }
    return a / b;
  },
};

function calculator(operation, a, b) {
  const fn = OPERATIONS[operation];
  if (!fn) {
    throw new Error(`Unknown operation: ${operation}`);
  }
  return fn(a, b);
}

function listOperations() {
  return Object.keys(OPERATIONS);
}

module.exports = { calculator, listOperations, OPERATIONS };
