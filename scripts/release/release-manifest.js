#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'artifacts');

function getMetadata() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const gitSha = (() => {
    try { return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); }
    catch { return 'unknown'; }
  })();
  return { name: pkg.name, version: pkg.version, gitSha };
}

function getDeps() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return Object.entries(deps).map(([name, version]) => ({ name, version }));
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const meta = getMetadata();
  const deps = getDeps();

  const manifest = {
    schemaVersion: 1,
    name: meta.name,
    version: meta.version,
    gitSha: meta.gitSha,
    generatedAt: new Date().toISOString(),
    dependencies: deps,
    build: {
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
    },
  };

  const out = path.join(OUT, 'release-manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${out}`);
  console.log(`Version: ${meta.version}`);
  console.log(`Git SHA: ${meta.gitSha}`);
  console.log(`Deps:    ${deps.length}`);
}

main();
