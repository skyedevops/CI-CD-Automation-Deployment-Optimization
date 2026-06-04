'use strict';

const { getConfig, DEFAULTS } = require('../../src/config');

describe('Config Module', () => {
  test('returns merged config with overrides', () => {
    const cfg = getConfig({ port: 4000, env: 'staging' });
    expect(cfg.port).toBe(4000);
    expect(cfg.env).toBe('staging');
    expect(cfg.host).toBe(DEFAULTS.host);
  });

  test('exports sane defaults', () => {
    expect(DEFAULTS.port).toBeGreaterThan(0);
    expect(DEFAULTS.host).toBeTruthy();
    expect(typeof DEFAULTS.appVersion).toBe('string');
  });

  test('overrides do not mutate DEFAULTS', () => {
    const before = { ...DEFAULTS };
    getConfig({ port: 9999 });
    expect(DEFAULTS).toEqual(before);
  });
});
