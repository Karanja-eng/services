#!/usr/bin/env node
/**
 * Production build wrapper.
 *
 * Why this exists
 * ---------------
 * Adding the real MLightCAD and That Open viewer engines to the bundle pushed
 * CRA's terser step past Node's default heap limit, and the build died with
 * "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of
 * memory" (recorded in chats/2026-10-23-unified-bim-workbench.md §6). The engines
 * themselves bundle correctly (webpack probe: 0 errors) and they are lazily loaded,
 * so the failure was purely build-time memory, not a code defect.
 *
 * The fix is deliberately build-configuration-only:
 *   * raise the heap for the build process (4 GB), and
 *   * skip production source maps by default (they roughly double peak memory;
 *     set GENERATE_SOURCEMAP=true when they are actually needed for debugging).
 *
 * Nothing about the application runtime changes. `npm run build:cra` still runs the
 * unmodified react-scripts build for anyone who wants to reproduce the old
 * behaviour or generate source maps with an externally configured heap.
 *
 * Cross-platform: no shell syntax, no extra dependency.
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const MAX_OLD_SPACE = process.env.FUNDI_BUILD_HEAP_MB || '4096';

const nodeOptions = [process.env.NODE_OPTIONS || '', `--max-old-space-size=${MAX_OLD_SPACE}`]
  .filter(Boolean)
  .join(' ')
  .trim();

const reactScripts = require.resolve('react-scripts/bin/react-scripts.js', {
  paths: [path.resolve(__dirname, '..')],
});

// `stdio: 'inherit'` keeps the compiler output streaming straight through, which is
// also what the Windows sandbox allows (it forbids capturing a child's piped stdio).
const result = spawnSync(process.execPath, [reactScripts, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GENERATE_SOURCEMAP: process.env.GENERATE_SOURCEMAP || 'false',
    NODE_OPTIONS: nodeOptions,
  },
});

if (result.error) {
  console.error(`[build] could not start react-scripts: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
