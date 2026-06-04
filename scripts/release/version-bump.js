#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PKG_PATH = path.join(ROOT, 'package.json');

const BUMP_TYPES = {
  patch: (v) => {
    const [maj, min, pat] = parse(v);
    return `${maj}.${min}.${pat + 1}`;
  },
  minor: (v) => {
    const [maj, min] = parse(v);
    return `${maj}.${min + 1}.0`;
  },
  major: (v) => {
    const [maj] = parse(v);
    return `${maj + 1}.0.0`;
  },
  premajor: (v) => {
    const [maj] = parse(v);
    return `${maj + 1}.0.0-alpha.0`;
  },
  preminor: (v) => {
    const [maj, min] = parse(v);
    return `${maj}.${min + 1}.0-alpha.0`;
  },
  prepatch: (v) => {
    const [maj, min, pat] = parse(v);
    return `${maj}.${min}.${pat + 1}-alpha.0`;
  },
};

function parse(version) {
  const m = version.replace(/-.*$/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`Not a semver version: ${version}`);
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function readPkg() {
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function writePkg(pkg) {
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function getArgs() {
  const args = process.argv.slice(2);
  const opts = { type: 'patch', dryRun: false, commit: false, tag: false, preid: 'rc' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--type' || a === '-t') { opts.type = args[++i]; }
    else if (a === '--preid') { opts.preid = args[++i]; }
    else if (a === '--dry-run') { opts.dryRun = true; }
    else if (a === '--commit') { opts.commit = true; }
    else if (a === '--tag') { opts.tag = true; }
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: version-bump.js [options]
Options:
  -t, --type <type>    Bump type: major|minor|patch|premajor|preminor|prepatch (default: patch)
  --preid <id>         Pre-release identifier (default: rc)
  --dry-run            Print version without changing files
  --commit             Create a git commit with the version bump
  --tag                Create a git tag (implies --commit)
  -h, --help           Show this help`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}

function bumpVersion(current, type, preid) {
  if (type.startsWith('pre')) {
    const base = BUMP_TYPES[type](current);
    return base.replace(/alpha|beta|rc/, preid);
  }
  if (!BUMP_TYPES[type]) {
    throw new Error(`Unknown bump type: ${type}`);
  }
  return BUMP_TYPES[type](current);
}

function main() {
  const opts = getArgs();
  const pkg = readPkg();
  const current = pkg.version;
  const next = bumpVersion(current, opts.type, opts.preid);

  console.log(`Current version: ${current}`);
  console.log(`Bump type:       ${opts.type}`);
  console.log(`Next version:    ${next}`);

  if (opts.dryRun) {
    console.log('\n(dry-run mode: no files changed)');
    process.exit(0);
  }

  pkg.version = next;
  writePkg(pkg);
  console.log(`\nUpdated package.json to ${next}`);

  if (opts.commit || opts.tag) {
    try {
      execSync('git add package.json package-lock.json', { cwd: ROOT, stdio: 'inherit' });
      execSync(`git commit -m "chore(release): v${next}"`, { cwd: ROOT, stdio: 'inherit' });
      console.log(`Created commit: chore(release): v${next}`);

      if (opts.tag) {
        execSync(`git tag -a v${next} -m "Release v${next}"`, { cwd: ROOT, stdio: 'inherit' });
        console.log(`Created tag: v${next}`);
      }
    } catch (e) {
      console.error('Git operation failed:', e.message);
      process.exit(1);
    }
  }
}

main();
