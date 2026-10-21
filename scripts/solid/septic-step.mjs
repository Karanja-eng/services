#!/usr/bin/env node
/**
 * Septic tank -> solids + STEP, as a short-lived process.
 *
 * Why a separate process
 * ----------------------
 * This OCCT build (opencascade.js 1.1.1) becomes unreliable for STEP export after a
 * long series of Boolean operations in one WASM instance: `STEPControl_Writer::Write`
 * then throws a raw C++ exception. Running the build-and-export in a fresh process
 * gives every export a clean kernel, which is both repeatable and cheap (about ten
 * seconds for the full septic tank).
 *
 * Because of that, this CLI is the supported entry point for STEP generation: the
 * Python API shells out to it, and the test suite asserts its JSON report and the
 * files it writes. Nothing here fabricates data — a failure exits non-zero with the
 * failing operation recorded in the report.
 *
 * Usage (from the repository root):
 *   node scripts/solid/septic-step.mjs \
 *     --model .test-artifacts/solid/model.json \
 *     --out public/step \
 *     --report .test-artifacts/solid/report.json
 *
 * `--model` is a canonical model document produced by
 * `src/Backend/cad_ifc/septic_model.py` (see `--print-model`).
 */
import fs from 'node:fs';
import path from 'node:path';

import { Kernel, loadKernel } from '../../src/solid/ocKernel.mjs';
import { buildSepticSolids, exportStep } from '../../src/solid/septicSolid.mjs';

function parseArgs(argv) {
  const args = { out: 'public/step', report: null, model: null };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--model') { args.model = value; index += 1; }
    else if (key === '--out') { args.out = value; index += 1; }
    else if (key === '--report') { args.report = value; index += 1; }
    else if (key === '--help' || key === '-h') { args.help = true; }
    else throw new Error(`unknown argument ${key}`);
  }
  return args;
}

function summarise(built) {
  return {
    schema: built.schema,
    modelId: built.modelId,
    units: built.units,
    components: built.components.map((component) => ({
      role: component.role,
      elementIds: component.elementIds,
      volumeM3: component.volumeM3,
      valid: component.valid,
      solidCount: component.solidCount,
      bbox: component.bbox,
      ...(component.accessOpening ? { accessOpening: component.accessOpening } : {}),
    })),
    operations: built.operations,
    penetrations: built.penetrations,
    warnings: built.warnings,
    overloads: built.overloads,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(__doc__());
    return 0;
  }
  if (!args.model) throw new Error('--model is required (a canonical septic model JSON)');

  const model = JSON.parse(fs.readFileSync(path.resolve(args.model), 'utf8'));
  const kernel = new Kernel(await loadKernel());
  const built = buildSepticSolids(kernel, model);
  const step = exportStep(kernel, built);

  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const file of step.files) {
    const target = path.join(outDir, file.fileName);
    fs.writeFileSync(target, Buffer.from(file.data));
    const { data, ...rest } = file;
    files.push({ ...rest, path: target, onDiskBytes: fs.statSync(target).size });
  }

  const report = {
    schema: 'fundi.solid.report/1',
    ok: true,
    generatedBy: 'scripts/solid/septic-step.mjs',
    model: summarise(built),
    step: { note: step.note, files },
    writtenAt: new Date().toISOString(),
  };
  if (args.report) {
    fs.mkdirSync(path.dirname(path.resolve(args.report)), { recursive: true });
    fs.writeFileSync(path.resolve(args.report), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(
    `septic solids: ` +
      report.model.components.map((c) => `${c.role}=${c.volumeM3.toFixed(4)}m3`).join(', ') +
      ` | STEP files: ${files.length}`,
  );
  for (const file of files) console.log(`  ${file.fileName}  ${file.bytes} bytes  ${file.path}`);
  return 0;
}

function __doc__() {
  return 'Usage: node scripts/solid/septic-step.mjs --model <json> --out <dir> [--report <json>]';
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    const message = error?.message ?? String(error);
    console.error(`septic-step failed: ${message}`);
    process.exitCode = 1;
  });
