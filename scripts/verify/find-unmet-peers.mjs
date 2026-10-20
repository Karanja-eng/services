// Walk node_modules, collect every peerDependency that cannot be *resolved* from
// the package that declares it, and list the ones that are genuinely absent.
//
// With `legacy-peer-deps=true` npm stops auto-installing peers (see .npmrc), so
// every peer that is genuinely needed must be declared explicitly in
// package.json. This script produces that list; only "MISSING" entries matter,
// because a present package at a different version is a range question, not a
// missing-file question.
//
// Usage: node scripts/verify/find-unmet-peers.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function walk(dir, depth, out) {
  if (depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.bin' || entry.name === '.cache') continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('@')) {
      walk(full, depth, out);
      continue;
    }
    const pkg = readJson(path.join(full, 'package.json'));
    if (pkg?.name) out.push({ dir: full, pkg });
    const nested = path.join(full, 'node_modules');
    if (fs.existsSync(nested)) walk(nested, depth + 1, out);
  }
}

const packages = [];
walk(path.join(root, 'node_modules'), 0, packages);

// Peers that are genuinely unused by this project, with the reason. Anything not
// listed here and missing is a real problem.
const KNOWN_UNUSED_PEERS = new Map([
  [
    'typescript',
    'No tsconfig.json exists, so Create React App never enables fork-ts-checker-webpack-plugin. ' +
      'The production build succeeds without TypeScript installed.',
  ],
]);

const missing = new Map();
const offVersion = new Map();

for (const { dir, pkg } of packages) {
  const peers = pkg.peerDependencies || {};
  const meta = pkg.peerDependenciesMeta || {};
  if (Object.keys(peers).length === 0) continue;

  let req;
  try {
    req = createRequire(path.join(dir, 'package.json'));
  } catch {
    continue;
  }

  for (const [name, range] of Object.entries(peers)) {
    if (meta[name]?.optional) continue;
    let installedVersion = null;
    try {
      installedVersion = req(`${name}/package.json`).version;
    } catch {
      try {
        // Some packages do not export ./package.json; fall back to resolution of
        // the entry point and then locate its package.json.
        const entry = req.resolve(name);
        let cursor = entry;
        for (let i = 0; i < 6; i += 1) {
          cursor = path.dirname(cursor);
          const candidate = path.join(cursor, 'package.json');
          if (fs.existsSync(candidate)) {
            installedVersion = readJson(candidate)?.version ?? 'unknown';
            break;
          }
        }
      } catch {
        installedVersion = null;
      }
    }
    if (installedVersion === null) {
      if (KNOWN_UNUSED_PEERS.has(name)) continue;
      if (!missing.has(name)) missing.set(name, { range, by: new Set() });
      missing.get(name).by.add(pkg.name);
    } else if (!offVersion.has(name)) {
      offVersion.set(name, { range, installed: installedVersion, by: new Set([pkg.name]) });
    }
  }
}

let failed = false;

if (missing.size) {
  failed = true;
  console.log('MISSING peer dependencies (must be added to package.json):\n');
  for (const [name, info] of [...missing.entries()].sort()) {
    console.log(`  ${name}@${info.range}`);
    console.log(`    required by: ${[...info.by].sort().join(', ')}`);
  }
  console.log('');
} else {
  console.log('No MISSING peer dependencies.');
}

const relevantOffVersion = [...offVersion.entries()].filter(([, info]) =>
  /^(three|web-ifc|camera-controls|@thatopen\/fragments|@mlightcad\/|@velipso\/polybool|lodash-es)/.test(
    info.by.keys().next().value ?? ''
  )
);
if (relevantOffVersion.length) {
  console.log('Present at a different version than declared (range check only):\n');
  for (const [name, info] of relevantOffVersion.sort()) {
    console.log(`  ${name}: installed ${info.installed}, declared ${info.range}`);
  }
}

process.exit(failed ? 1 : 0);
