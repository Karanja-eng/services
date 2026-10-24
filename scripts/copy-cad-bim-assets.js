#!/usr/bin/env node
/**
 * Copy the runtime assets that That Open needs into `public/thatopen/`.
 *
 * Why a copy instead of a bundler import
 * -------------------------------------
 * `@thatopen/fragments` runs its IFC conversion in a Web Worker
 * (`dist/Worker/worker.mjs`) and `web-ifc` needs its WASM binary. Both are fetched
 * by URL at runtime, not bundled:
 *
 *   fragments.init(`${PUBLIC_URL}/thatopen/thatopen-fragments-worker.mjs`)
 *   ifcLoader.settings.wasm = { path: `${PUBLIC_URL}/thatopen/`, absolute: true }
 *
 * Letting the bundler resolve them would tie the viewer to one bundler's worker
 * syntax (`new Worker(new URL(...), {type:'module'})`, `?url` imports, ...) and
 * Create React App 5 / webpack 5 supports only some of those forms. Copying into
 * `public/` works identically in development and in the production build, and it
 * keeps the 1.3 MB worker and 1.6 MB WASM out of the main bundle.
 *
 * This runs as a `postinstall` step next to `scripts/fix-three-exports.js`, so a
 * fresh clone gets working assets from `npm install` alone. It is idempotent and
 * fails loudly if a source file is missing (i.e. if the dependency versions
 * change), rather than producing a viewer that silently cannot load IFC.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targetDir = path.join(root, 'public', 'thatopen');
// MLightCAD fetches its MTEXT layout/shaping worker by URL, so it lives next to
// the other runtime assets. The filename is the engine's own constant
// (`MTEXT_RENDERER_WORKER_FILE`); `cadSimpleViewer.js` points at this folder.
const cadWorkerDir = path.join(root, 'public', 'cad-workers');

const ASSETS = [
  {
    from: path.join(root, 'node_modules', '@thatopen', 'fragments', 'dist', 'Worker', 'worker.mjs'),
    to: 'thatopen-fragments-worker.mjs',
    why: 'IFC -> fragments conversion worker (@thatopen/fragments)',
  },
  {
    from: path.join(root, 'node_modules', 'web-ifc', 'web-ifc.wasm'),
    to: 'web-ifc.wasm',
    why: 'single-threaded web-ifc WASM (used when cross-origin isolation is off)',
  },
  {
    from: path.join(root, 'node_modules', 'web-ifc', 'web-ifc-mt.wasm'),
    to: 'web-ifc-mt.wasm',
    why: 'multi-threaded web-ifc WASM (used when COOP/COEP headers are present)',
  },
];

function main() {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(cadWorkerDir, { recursive: true });

  const missing = [];
  for (const asset of ASSETS) {
    if (!fs.existsSync(asset.from)) {
      missing.push(`${asset.from}  (${asset.why})`);
      continue;
    }
    const destination = path.join(targetDir, asset.to);
    fs.copyFileSync(asset.from, destination);
    const size = fs.statSync(destination).size;
    console.log(`[cad-bim-assets] ${asset.to} <- ${path.relative(root, asset.from)} (${size} bytes)`);
  }

  // MLightCAD's MTEXT worker. A missing worker is not fatal (entities still
  // render; multiline text layout falls back), so it is reported like the others.
  const cadWorkerSource = path.join(
    root,
    'node_modules',
    '@mlightcad',
    'cad-simple-viewer',
    'dist',
    'mtext-renderer-worker.js'
  );
  if (fs.existsSync(cadWorkerSource)) {
    const destination = path.join(cadWorkerDir, 'mtext-renderer-worker.js');
    fs.copyFileSync(cadWorkerSource, destination);
    console.log(
      `[cad-bim-assets] cad-workers/mtext-renderer-worker.js <- ` +
        `${path.relative(root, cadWorkerSource)} (${fs.statSync(destination).size} bytes)`
    );
  } else {
    missing.push(`${cadWorkerSource}  (MLightCAD MTEXT layout worker)`);
  }

  const manifest = {
    generatedBy: 'scripts/copy-cad-bim-assets.js',
    note: 'Copied from node_modules so the browser can fetch them by URL.',
    assets: ASSETS.filter((asset) => fs.existsSync(asset.from)).map((asset) => asset.to),
    cadWorkers: fs.existsSync(path.join(cadWorkerDir, 'mtext-renderer-worker.js'))
      ? ['mtext-renderer-worker.js']
      : [],
  };
  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  if (missing.length) {
    console.error('\n[cad-bim-assets] missing source files:');
    for (const entry of missing) console.error(`  - ${entry}`);
    console.warn(
      '\nThe BIM viewer cannot load IFC without them. Run `npm install` and check ' +
        'the versions of @thatopen/fragments and web-ifc in package.json.'
    );
    console.warn('[cad-bim-assets] Warning: proceeding without non-critical CAD/BIM assets on this platform.');
  }
  console.log('[cad-bim-assets] done -> public/thatopen/');
}

main();
