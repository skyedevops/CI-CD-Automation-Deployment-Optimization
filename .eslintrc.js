'use strict';

module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'smart'],
    curly: ['error', 'multi-line'],
  },
  ignorePatterns: ['node_modules/', 'coverage/', 'dist/', '*.log', '.env'],
};
