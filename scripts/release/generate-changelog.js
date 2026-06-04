#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CHANGELOG_PATH = path.join(ROOT, 'docs', 'CHANGELOG.md');

const COMMIT_TYPES = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  refactor: 'Code Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build System',
  ci: 'CI/CD',
  chore: 'Chores',
  style: 'Styles',
  revert: 'Reverts',
};

function getArgs() {
  const args = process.argv.slice(2);
  const opts = { version: '', fromTag: '', toTag: 'HEAD', write: false, output: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--version' || a === '-v') { opts.version = args[++i]; }
    else if (a === '--from') { opts.fromTag = args[++i]; }
    else if (a === '--to') { opts.toTag = args[++i]; }
    else if (a === '--write') { opts.write = true; }
    else if (a === '--output' || a === '-o') { opts.output = args[++i]; }
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: generate-changelog.js [options]
Options:
  -v, --version <ver>   Version string (e.g. 1.2.3)
  --from <tag>          Starting tag/commit (default: previous tag)
  --to <ref>            Ending ref (default: HEAD)
  --write               Write to docs/CHANGELOG.md
  -o, --output <path>   Custom output file path
  -h, --help            Show this help`);
      process.exit(0);
    }
  }
  return opts;
}

function exec(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (_) {
    return '';
  }
}

function getCommits(fromRef, toRef) {
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const format = '%H|%h|%an|%ae|%s';
  const out = exec(`git log --no-merges --pretty=format:"${format}" ${range}`);
  if (!out) return [];
  return out.split('\n').map((line) => {
    const [hash, short, author, email, subject] = line.split('|');
    return { hash, short, author, email, subject };
  });
}

function categorizeCommits(commits) {
  const categories = {};
  for (const c of commits) {
    const match = c.subject.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
    let type, scope, message;
    if (match) {
      type = match[1].toLowerCase();
      scope = match[2];
      message = match[3];
    } else {
      type = 'other';
      scope = '';
      message = c.subject;
    }
    const category = COMMIT_TYPES[type] || 'Other Changes';
    if (!categories[category]) categories[category] = [];
    categories[category].push({ ...c, scope, message });
  }
  return categories;
}

function detectPreviousTag() {
  const tag = exec('git describe --tags --abbrev=0 HEAD~1 2>/dev/null');
  return tag || '';
}

function renderChangelog(version, categories, date) {
  let out = '';
  out += `## [${version}] - ${date}\n\n`;

  const ordered = [
    'Features', 'Bug Fixes', 'Performance Improvements', 'Code Refactoring',
    'Documentation', 'Tests', 'Build System', 'CI/CD', 'Chores', 'Other Changes',
  ];

  for (const cat of ordered) {
    const items = categories[cat];
    if (!items || items.length === 0) continue;
    out += `### ${cat}\n\n`;
    for (const item of items) {
      const scope = item.scope ? `**${item.scope}**: ` : '';
      out += `- ${scope}${item.message} (${item.short})\n`;
    }
    out += '\n';
  }

  return out;
}

function prependToChangelog(existing, newEntry) {
  if (!existing) return `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n${newEntry}`;
  // Find the position after the header section
  const match = existing.match(/^(# Changelog[\s\S]*?(?=\n## ))/);
  if (match) {
    return match[1] + '\n' + newEntry + existing.slice(match[0].length);
  }
  return `# Changelog\n\n${newEntry}\n${existing}`;
}

function main() {
  const opts = getArgs();

  if (!opts.version) {
    console.error('Error: --version is required');
    process.exit(1);
  }

  const fromRef = opts.fromTag || detectPreviousTag();
  console.log(`Generating changelog for v${opts.version} (${fromRef || 'initial'}..${opts.toTag})`);

  const commits = getCommits(fromRef, opts.toTag);
  if (commits.length === 0) {
    console.log('No commits found in range. Exiting.');
    process.exit(0);
  }
  console.log(`Found ${commits.length} commits`);

  const categories = categorizeCommits(commits);
  const today = new Date().toISOString().slice(0, 10);
  const entry = renderChangelog(opts.version, categories, today);

  const out = entry;

  if (opts.write) {
    fs.mkdirSync(path.dirname(CHANGELOG_PATH), { recursive: true });
    const existing = fs.existsSync(CHANGELOG_PATH) ? fs.readFileSync(CHANGELOG_PATH, 'utf8') : '';
    const updated = prependToChangelog(existing, entry);
    fs.writeFileSync(CHANGELOG_PATH, updated);
    console.log(`Wrote changelog to ${CHANGELOG_PATH}`);
  } else if (opts.output) {
    fs.writeFileSync(opts.output, out);
    console.log(`Wrote changelog to ${opts.output}`);
  } else {
    process.stdout.write(out);
  }
}

main();
