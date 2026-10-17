// scripts/fix-three-exports.js
//
// Repairs three third-party packaging defects that make the MLightCAD packages
// unbuildable with Create React App's webpack 5. They build fine under Vite,
// which is why the proven Fundi Pulse app never hit them.
//
// These packages are ESM (type: module) and webpack resolves ESM imports in
// strict mode: every specifier must name an existing file. Their sources rely
// on the looser rules a bundler like Vite applies. Concretely:
//
// 1. three.js addons imported without an extension
//      import Stats from 'three/examples/jsm/libs/stats.module'
//    three 0.172 maps the examples/jsm wildcard to itself, so the specifier
//    maps to a non-existent extensionless path and strict ESM refuses to
//    append the extension. Fix: add exact exports entries for the real files.
//
// 2. relative directory imports inside the mlightcad lib directories
//      export * from './base/'
//    Strict ESM has no directory resolution, so those re-exports disappear and
//    consumers fail with missing named exports. Fix: append the explicit
//    index.js / .js target wherever that file actually exists.
//
// 3. exports conditions that point at TypeScript sources
//      the icons subpath resolves to ./src/ui/icons.ts, which CRA cannot load.
//    Fix: point the subpath at the compiled lib file when it exists.
//
// Every change is additive, idempotent and verified against the filesystem
// before being applied. The script touches only node_modules, never application
// source, and becomes a no-op once the packages fix their imports or CRA is
// replaced by a bundler with relaxed resolution.
'use strict';

'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const nodeModules = path.join(root, 'node_modules');
const threeDir = path.join(nodeModules, 'three');
const mlightcadDir = path.join(nodeModules, '@mlightcad');

function log(message) {
  console.log(`[fix-import-resolution] ${message}`);
}

if (!fs.existsSync(nodeModules)) process.exit(0);

const changes = [];

// ---------------------------------------------------------------------------
// 1. three addon specifiers (extensionless) -> exact exports entries
// ---------------------------------------------------------------------------

function fixThreeExports() {
  const pkgPath = path.join(threeDir, 'package.json');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(mlightcadDir)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const exportsMap = pkg.exports || {};
  if (!exportsMap['./examples/jsm/*']) return;

  const specifiers = new Set();
  for (const entry of fs.readdirSync(mlightcadDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    for (const sub of ['dist', 'lib']) {
      const dir = path.join(mlightcadDir, entry.name, sub);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!/\.(js|cjs|mjs)$/.test(file)) continue;
        let contents;
        try {
          contents = fs.readFileSync(path.join(dir, file), 'utf8');
        } catch {
          continue;
        }
        for (const match of contents.match(/\bthree\/examples\/[A-Za-z0-9._\-/]+/g) || []) {
          specifiers.add(match);
        }
      }
    }
  }

  let patched = 0;
  for (const specifier of specifiers) {
    const subpath = './' + specifier.replace(/^three\//, '');
    if (Object.prototype.hasOwnProperty.call(exportsMap, subpath)) continue;

    try {
      require.resolve(specifier, { paths: [root] });
      continue; // already resolvable
    } catch {
      /* needs repair */
    }

    const onDisk = path.join(threeDir, specifier.replace(/^three\//, ''));
    const candidate = [onDisk, `${onDisk}.js`, `${onDisk}.mjs`].find(
      (p) => fs.existsSync(p) && fs.statSync(p).isFile()
    );
    if (!candidate) continue;

    exportsMap[subpath] = './' + path.relative(threeDir, candidate).split(path.sep).join('/');
    patched += 1;
    changes.push(`three exports: ${subpath} -> ${exportsMap[subpath]}`);
  }

  if (patched > 0) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
}

// ---------------------------------------------------------------------------
// 2. relative directory / extensionless imports in @mlightcad lib sources
// ---------------------------------------------------------------------------

const RELATIVE_SPECIFIER = /((?:from|import)\s*\(?\s*['"])(\.[^'"]+)(['"])/g;

function resolveRelative(fromFile, specifier) {
  const target = path.resolve(path.dirname(fromFile), specifier);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return null; // fine
  if (fs.existsSync(`${target}.js`)) return `${specifier}.js`;
  if (fs.existsSync(`${target}.mjs`)) return `${specifier}.mjs`;
  if (fs.existsSync(path.join(target, 'index.js'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  return null;
}

function fixRelativeImports() {
  if (!fs.existsSync(mlightcadDir)) return;

  let filesChanged = 0;
  let specifiersFixed = 0;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|mjs)$/.test(entry.name)) continue;
      // Only the ESM sources; dist/*.cjs and *.umd.cjs bundles are self-contained.
      if (full.includes(`${path.sep}dist${path.sep}`)) continue;

      const source = fs.readFileSync(full, 'utf8');
      let updated = source;
      let local = 0;
      updated = updated.replace(RELATIVE_SPECIFIER, (match, prefix, specifier, suffix) => {
        if (!specifier.startsWith('.')) return match;
        const replacement = resolveRelative(full, specifier);
        if (!replacement) return match;
        local += 1;
        return `${prefix}${replacement}${suffix}`;
      });

      if (local > 0) {
        fs.writeFileSync(full, updated, 'utf8');
        filesChanged += 1;
        specifiersFixed += local;
      }
    }
  };

  walk(mlightcadDir);
  if (specifiersFixed > 0) {
    changes.push(`relative imports: ${specifiersFixed} specifier(s) in ${filesChanged} file(s)`);
  }
}

// ---------------------------------------------------------------------------
// 3. exports subpaths pointing at TypeScript sources
// ---------------------------------------------------------------------------

function fixTypeScriptExportTargets() {
  if (!fs.existsSync(mlightcadDir)) return;

  for (const entry of fs.readdirSync(mlightcadDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const packageDir = path.join(mlightcadDir, entry.name);
    const pkgPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.exports || typeof pkg.exports !== 'object') continue;

    let patched = 0;
    const rewrite = (value) => {
      if (typeof value !== 'string' || !value.endsWith('.ts')) return value;
      const jsCandidate = [
        value.replace(/^\.\/src\//, './lib/').replace(/\.ts$/, '.js'),
        value.replace(/\.ts$/, '.js'),
      ].find((candidate) => fs.existsSync(path.join(packageDir, candidate)));
      if (!jsCandidate) return value;
      patched += 1;
      changes.push(`${pkg.name}: exports ${value} -> ${jsCandidate}`);
      return jsCandidate;
    };

    const visit = (node) => {
      if (Array.isArray(node)) return node.map(visit);
      if (node && typeof node === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(node)) {
          out[key] = typeof value === 'string' ? rewrite(value) : visit(value);
        }
        return out;
      }
      return node;
    };

    const updatedExports = visit(pkg.exports);
    if (patched > 0) {
      pkg.exports = updatedExports;
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    }
  }
}

try {
  fixThreeExports();
  fixRelativeImports();
  fixTypeScriptExportTargets();
} catch (error) {
  log(`warning: ${error.message}`);
  process.exit(0); // never break install
}

if (changes.length === 0) {
  log('nothing to do');
} else {
  log(`applied ${changes.length} repair(s) to node_modules:`);
  for (const change of changes) log(`  ${change}`);
}
