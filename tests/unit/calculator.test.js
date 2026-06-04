'use strict';

const { calculator, listOperations } = require('../../src/services/calculator');

describe('Calculator Service', () => {
  describe('listOperations()', () => {
    test('returns all four arithmetic operations', () => {
      const ops = listOperations();
      expect(ops).toEqual(expect.arrayContaining(['add', 'subtract', 'multiply', 'divide']));
      expect(ops).toHaveLength(4);
    });
  });

  describe('add()', () => {
    test.each([
      [1, 2, 3],
      [0, 0, 0],
      [-5, 5, 0],
      [1.5, 2.5, 4],
      [1000000, 2000000, 3000000],
    ])('adds %i + %i = %i', (a, b, expected) => {
      expect(calculator('add', a, b)).toBe(expected);
    });
  });

  describe('subtract()', () => {
    test.each([
      [5, 3, 2],
      [0, 0, 0],
      [-5, -5, 0],
      [10, 15, -5],
    ])('subtracts %i - %i = %i', (a, b, expected) => {
      expect(calculator('subtract', a, b)).toBe(expected);
    });
  });

  describe('multiply()', () => {
    test.each([
      [3, 4, 12],
      [0, 100, 0],
      [-2, 5, -10],
      [1.5, 2, 3],
    ])('multiplies %i * %i = %i', (a, b, expected) => {
      expect(calculator('multiply', a, b)).toBe(expected);
    });
  });

  describe('divide()', () => {
    test.each([
      [10, 2, 5],
      [9, 3, 3],
      [-10, 2, -5],
      [1, 4, 0.25],
    ])('divides %i / %i = %i', (a, b, expected) => {
      expect(calculator('divide', a, b)).toBe(expected);
    });

    test('throws on division by zero', () => {
      expect(() => calculator('divide', 10, 0)).toThrow('Division by zero');
    });
  });

  describe('error handling', () => {
    test('throws on unknown operation', () => {
      expect(() => calculator('modulo', 5, 3)).toThrow('Unknown operation');
    });
  });
});
