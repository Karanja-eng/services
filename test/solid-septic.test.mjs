// Acceptance tests for the septic-tank solid modelling (Task 4, criteria 1-10).
//
// Run with: node test/solid-septic.test.mjs
//
// (`node --test` spawns a worker per file with piped stdio, which restricted
// sandboxes block with EPERM. Running the file directly executes the same node:test
// suite in-process, so the assertions are identical.)
//
// The canonical model is produced by the *real* Python generator
// (src/Backend/cad_ifc/septic_model.py) and passed in as JSON, so the solids are
// provably built from the same parameters as the DXF and the IFC. Nothing here
// hand-writes a model or a dimension.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { Kernel, loadKernel } from '../src/solid/ocKernel.mjs';
import { buildSepticSolids, exportStep } from '../src/solid/septicSolid.mjs';

const REPO = path.resolve('.');
const PYTHON = path.join(REPO, '.venv-ifc', 'Scripts', 'python.exe');
const WORK = path.join(REPO, '.test-artifacts', 'solid');
let fixtureCount = 0;

/**
 * Ask the real generator for the canonical septic model.
 *
 * Python's stdout goes to a file descriptor rather than a pipe: the sandbox forbids
 * opening the named pipes that `execFileSync`/`stdio: 'pipe'` rely on, so the JSON is
 * written to a temporary file and read back.
 */
function canonicalModel(overrides = null) {
  fs.mkdirSync(WORK, { recursive: true });
  const script = `
import json, sys
sys.path.insert(0, r"${path.join(REPO, 'src', 'Backend')}")
from cad_ifc import septic_model
params = json.loads(sys.argv[1]) if len(sys.argv) > 1 else None
sys.stdout.write(json.dumps(septic_model.build_model(params)))
`;
  fixtureCount += 1;
  const outFile = path.join(WORK, `model-${process.pid}-${fixtureCount}.json`);
  const fd = fs.openSync(outFile, 'w');
  const result = spawnSync(
    PYTHON,
    ['-c', script, JSON.stringify(overrides ?? null)],
    { stdio: ['ignore', fd, 'inherit'] },
  );
  fs.closeSync(fd);
  if (result.status !== 0) {
    throw new Error(`python generator failed (status ${result.status}): ${result.error ?? ''}`);
  }
  return JSON.parse(fs.readFileSync(outFile, 'utf8'));
}

const hasPython = fs.existsSync(PYTHON);
const skipReason = hasPython ? false : `python interpreter not found at ${PYTHON}`;

describe('septic tank solid modelling', { skip: skipReason }, () => {
  /** @type {Kernel} */
  let kernel;
  /** @type {object} */
  let built;
  /** @type {object} */
  let model;

  before(async () => {
    kernel = new Kernel(await loadKernel());
    model = canonicalModel();
    built = buildSepticSolids(kernel, model);
  });

  it('1. produces valid base slab and wall solids (non-empty solids, not faces)', () => {
    const tank = built.components.find((component) => component.role === 'tank');
    assert.ok(tank, 'no tank component');
    assert.ok(tank.valid, 'tank solid is not valid');
    assert.ok(tank.solidCount >= 1, `tank has ${tank.solidCount} solids`);
    assert.ok(tank.volumeM3 > 1, `tank volume ${tank.volumeM3} is implausible`);
  });

  it('2. includes the internal partitions the generator defines', () => {
    const tank = built.components.find((component) => component.role === 'tank');
    const baffleIds = tank.elementIds.filter((id) => id.includes('baffle'));
    assert.equal(baffleIds.length, model.parameters.num_baffles,
      `expected ${model.parameters.num_baffles} baffles, model references ${baffleIds.length}`);

    // Their volume must be inside the tank solid: build without baffles and compare.
    const noBaffles = canonicalModel({ num_baffles: 0 });
    const withoutBuilt = buildSepticSolids(kernel, noBaffles);
    const withoutTank = withoutBuilt.components.find((component) => component.role === 'tank');
    const expected =
      model.parameters.baffle_thick * model.parameters.tank_int_w * model.parameters.baffle_heights[0] +
      model.parameters.baffle_thick * model.parameters.tank_int_w * model.parameters.baffle_heights[1];
    const actual = tank.volumeM3 - withoutTank.volumeM3;
    assert.ok(Math.abs(actual - expected) < 1e-6,
      `baffle volume in solid ${actual.toFixed(9)} != expected ${expected.toFixed(9)}`);
  });

  it('3. models parameterised openings', () => {
    assert.ok(built.penetrations.length >= 2, `only ${built.penetrations.length} penetrations`);
    for (const hole of built.penetrations) {
      assert.ok(hole.radius > 0, 'penetration radius must be positive');
      assert.ok(Array.isArray(hole.elementIds) && hole.elementIds.length > 0,
        'penetration must reference the element(s) it belongs to');
    }
    const manhole = built.components.find((component) => component.role === 'manhole');
    assert.ok(manhole.accessOpening, 'manhole has no access opening');
    assert.ok(manhole.accessOpening.removedM3 > 0, 'access opening removed no material');
  });

  it('4. openings actually remove material from the correct solids', () => {
    // Each through-wall hole must remove pi r^2 t of the wall it crosses.
    const applied = built.penetrations.filter((hole) => hole.applied);
    assert.ok(applied.length >= 2, `only ${applied.length} penetrations removed material`);
    for (const hole of applied) {
      assert.ok(hole.removedM3 > 0, `hole ${hole.elementIds.join('+')} removed nothing`);
      assert.ok(Math.abs(hole.ratio - 1) < 0.02,
        `hole ${hole.elementIds.join('+')} removed ${hole.removedM3.toFixed(9)} m3, ` +
        `${(hole.ratio * 100).toFixed(1)}% of the analytic pi*r^2*t (${hole.expectedM3.toFixed(9)})`);
    }
    // A pipe that reaches no wall is a source-data inconsistency. It must be reported
    // as a warning and must not silently remove material elsewhere.
    for (const hole of built.penetrations.filter((entry) => !entry.applied)) {
      assert.equal(hole.removedM3, 0, 'an unreachable pipe must not remove material');
      assert.ok(hole.reason && hole.reason.length > 20, 'the reason must be explained');
      assert.ok(
        built.warnings.some((warning) =>
          warning.elementIds.some((id) => hole.elementIds.includes(id))),
        `no warning recorded for unreachable pipe ${hole.elementIds.join('+')}`,
      );
    }
    // The access opening cuts through the cover slab and the cover, whose footprints
    // differ, so the removed volume is the slab part plus the (smaller) cover.
    const manhole = built.components.find((component) => component.role === 'manhole');
    const coverSlab = model.elements.find((element) => element.id.endsWith('manhole.cover_slab'));
    const cover = model.elements.find((element) => element.id.endsWith('manhole.cover'));
    const openingArea = model.parameters.manhole_int_l * model.parameters.manhole_int_w;
    const coverArea = cover.dimensions.length_x * cover.dimensions.width_y;
    const expectedRemoved =
      openingArea * coverSlab.dimensions.height_z + coverArea * cover.dimensions.height_z;
    assert.ok(Math.abs(manhole.accessOpening.removedM3 - expectedRemoved) < 1e-9,
      `access opening removed ${manhole.accessOpening.removedM3.toFixed(9)} != expected ` +
      `${expectedRemoved.toFixed(9)} (cover slab ${coverSlab.dimensions.height_z} m + ` +
      `cover ${cover.dimensions.height_z} m)`);
  });

  it('5. fuses where structurally appropriate and reports the operation log', () => {
    const fuses = built.operations.filter((operation) => operation.kind === 'fuse');
    const cuts = built.operations.filter((operation) => operation.kind === 'cut');
    assert.ok(fuses.length >= 10, `expected the member solids to be fused, got ${fuses.length} fuses`);
    assert.ok(cuts.length >= 3, `expected opening cuts, got ${cuts.length} cuts`);
    for (const operation of cuts) {
      if (operation.redundant) {
        // The member solids already form a closed shell, so the internal-void cut is
        // expected to remove nothing; it exists to prove the shell is hollow.
        assert.equal(operation.deltaM3, 0,
          `redundant cut "${operation.label}" unexpectedly removed ${operation.deltaM3} m3`);
        continue;
      }
      assert.ok(operation.removedMaterial,
        `cut "${operation.label}" did not remove material (delta ${operation.deltaM3})`);
    }
    // And the shell really is hollow: the fused members equal the envelope minus the
    // internal void, i.e. the member geometry already excludes the internal volume.
    const tank = built.components.find((component) => component.role === 'tank');
    const p = model.parameters;
    const outer = model.derived.tank_external_length_m * model.derived.tank_external_width_m *
      model.derived.tank_external_height_m;
    const internal = p.tank_int_l * p.tank_int_w * p.tank_depth_int;
    assert.ok(Math.abs(tank.envelopeVolumeM3 - (outer - internal)) < 1e-6,
      `fused members ${tank.envelopeVolumeM3.toFixed(6)} != outer-internal ` +
      `${(outer - internal).toFixed(6)}`);
  });

  it('6. validates the shape after every major operation', () => {
    assert.ok(built.operations.length > 0, 'no operations recorded');
    for (const operation of built.operations) {
      assert.ok(operation.valid, `operation "${operation.label}" produced an invalid shape`);
    }
    for (const component of built.components) {
      assert.ok(component.valid, `component ${component.role} is invalid`);
    }
  });

  it('7. matches the source parameters: overall external dimensions', () => {
    const tank = built.components.find((component) => component.role === 'tank');
    const derived = model.derived;
    // 1e-6 m = 1 micrometre: Bnd_Box and Boolean tolerance, not a modelling error.
    const tolerance = 1e-6;
    assert.ok(Math.abs(tank.bbox.size.x - derived.tank_external_length_m) < tolerance,
      `tank X ${tank.bbox.size.x} != derived ${derived.tank_external_length_m}`);
    assert.ok(Math.abs(tank.bbox.size.y - derived.tank_external_width_m) < tolerance,
      `tank Y ${tank.bbox.size.y} != derived ${derived.tank_external_width_m}`);
    assert.ok(Math.abs(tank.bbox.size.z - derived.tank_external_height_m) < tolerance,
      `tank Z ${tank.bbox.size.z} != derived ${derived.tank_external_height_m}`);
  });

  it('8. matches the source parameters: internal dimensions and wall thickness', () => {
    // Solid volume = envelope - internal void + baffles - penetrations. Reconstruct it
    // from the canonical parameters alone and compare with the kernel's own volume.
    const p = model.parameters;
    const envelope =
      p.tank_int_l * p.tank_int_w * p.tank_depth_int; // internal void
    const outer =
      model.derived.tank_external_length_m * model.derived.tank_external_width_m *
      model.derived.tank_external_height_m;
    const baffleVolume = p.baffle_thick * p.tank_int_w *
      (p.baffle_heights[0] + p.baffle_heights[1]);
    const holeVolume = built.penetrations
      .filter((hole) => hole.shell === 'tank' && hole.applied)
      .reduce((sum, hole) => sum + Math.PI * hole.radius * hole.radius * p.wall_thick, 0);
    const expected = outer - envelope + baffleVolume - holeVolume;
    const tank = built.components.find((component) => component.role === 'tank');
    assert.ok(Math.abs(tank.volumeM3 - expected) < 1e-6,
      `tank solid volume ${tank.volumeM3.toFixed(9)} != analytic ${expected.toFixed(9)} ` +
      `(wall thickness ${p.wall_thick} m, base ${p.bed_thick_tank} m, top ${p.slab_thick} m)`);

    // Wall thickness is implied by the difference between the envelope and the
    // member volumes: the fused shell already excludes the internal void.
    const voidCut = built.operations.find((operation) => operation.label === 'tank internal void cut');
    assert.ok(voidCut, 'no internal void cut was attempted');
    assert.equal(voidCut.deltaM3, 0,
      'the fused member solids are expected to form a closed hollow shell, so the ' +
      `internal void cut should remove nothing (it removed ${voidCut.deltaM3} m3)`);
    const internal = model.parameters.tank_int_l * model.parameters.tank_int_w *
      model.parameters.tank_depth_int;
    assert.ok(Math.abs((outer - internal) - tank.envelopeVolumeM3) < 1e-6,
      `outer-minus-internal ${(outer - internal).toFixed(6)} != fused members ` +
      `${tank.envelopeVolumeM3.toFixed(6)}`);
  });

  it('9. uses the generator coordinate system and units consistently', () => {
    assert.equal(built.units.length, 'metre');
    const tank = built.components.find((component) => component.role === 'tank');
    // Base slab bottom sits at z = 0 and the whole tank is centred on x = 0, y = 0,
    // exactly as the canonical model places it (1e-6 m tolerance covers Bnd_Box).
    assert.ok(Math.abs(tank.bbox.min.z) < 1e-6, `tank base at z=${tank.bbox.min.z}`);
    assert.ok(Math.abs(tank.bbox.min.x + tank.bbox.size.x / 2) < 1e-6,
      'tank is not centred on the canonical origin in X');
    assert.ok(Math.abs(tank.bbox.min.y + tank.bbox.size.y / 2) < 1e-6,
      'tank is not centred on the canonical origin in Y');
    // The manhole is offset to +X exactly as the model says.
    const manhole = built.components.find((component) => component.role === 'manhole');
    const manholeBase = model.elements.find((element) => element.id.endsWith('manhole.base_slab'));
    assert.ok(Math.abs((manhole.bbox.min.x + manhole.bbox.size.x / 2) - manholeBase.placement.x) < 1e-6,
      'manhole is not where the canonical model places it');
  });

  it('10. rejects impossible geometry instead of returning a plausible model', () => {
    // The Python generator itself rejects a negative thickness, so the adapter is
    // tested against a document that was corrupted after generation (the case a
    // caller could produce by hand-editing a stored model).
    const corrupted = canonicalModel();
    corrupted.parameters.wall_thick = -0.2;
    assert.throws(() => buildSepticSolids(kernel, corrupted), /wall_thick must be a positive/,
      'a negative wall thickness must be rejected');

    const zeroBaffle = canonicalModel({ num_baffles: 0 });
    const built0 = buildSepticSolids(kernel, zeroBaffle);
    assert.equal(built0.components.find((c) => c.role === 'tank').elementIds
      .filter((id) => id.includes('baffle')).length, 0);
  });

  it('11. exports genuine STEP and verifies its structure', async () => {
    // This OCCT build throws a raw C++ exception if the STEP writer is used after a
    // long series of Boolean operations in the same WASM instance, so the export runs
    // in a fresh kernel (see the module docstring and scripts/solid/septic-step.mjs).
    const exportKernel = new Kernel(await loadKernel());
    const exportBuilt = buildSepticSolids(exportKernel, canonicalModel());
    const step = exportStep(exportKernel, exportBuilt);
    assert.equal(step.files.length, exportBuilt.components.length,
      `exported ${step.files.length} STEP files for ${exportBuilt.components.length} components`);

    const outDir = path.join(REPO, '.test-artifacts', 'solid', 'step');
    fs.mkdirSync(outDir, { recursive: true });
    let reimported = 0;

    for (const file of step.files) {
      // Structure: a real STEP solid, in metres, properly terminated.
      assert.ok(file.isStep, `${file.role}: not STEP (head: ${file.head})`);
      assert.ok(file.terminated, `${file.role}: STEP file is not terminated`);
      assert.ok(file.bytes > 1000, `${file.role}: only ${file.bytes} bytes`);
      assert.ok(file.entities > 50, `${file.role}: only ${file.entities} STEP entities`);
      assert.ok(file.solidBreps >= 1,
        `${file.role}: no MANIFOLD_SOLID_BREP — the file is not a solid model`);
      assert.ok(file.closedShells >= 1, `${file.role}: no CLOSED_SHELL`);
      assert.ok(file.advancedFaces >= 3, `${file.role}: only ${file.advancedFaces} faces`);
      assert.ok(file.lengthUnitMetre, `${file.role}: no metric LENGTH_UNIT declared`);

      // Kernel reimport: accepted when it works, recorded when it fails. It must never
      // be silently skipped, and a successful reimport must match the source volume.
      if (file.reimport) {
        reimported += 1;
        assert.ok(file.reimport.valid, `${file.role}: reimported shape is invalid`);
        assert.ok(Math.abs(file.reimport.volumeDeltaM3) < 1e-6,
          `${file.role}: reimported volume differs by ${file.reimport.volumeDeltaM3} m3`);
      } else {
        assert.ok(file.reimportError, `${file.role}: reimport produced neither a result nor an error`);
        console.log(`note: kernel reimport unavailable for ${file.role} (${file.reimportError}); ` +
          'verified structurally instead');
      }

      const outPath = path.join(outDir, file.fileName);
      fs.writeFileSync(outPath, Buffer.from(file.data));
      const onDisk = fs.readFileSync(outPath, 'utf8');
      assert.ok(onDisk.startsWith('ISO-10303-21'), `${file.role}: file on disk is not STEP`);
      assert.ok(onDisk.trimEnd().endsWith('END-ISO-10303-21;'),
        `${file.role}: STEP file on disk is not terminated`);
      assert.equal(Buffer.byteLength(onDisk), file.bytes, `${file.role}: byte count changed on write`);
    }

    // The combined-assembly limitation must be documented in the result, not hidden.
    assert.match(step.note, /one STEP file per solid/i);
    console.log(`STEP: ${step.files.length} files, ${reimported} verified by kernel reimport, ` +
      `${step.files.length - reimported} by structural inspection`);
  });

  it('12. is repeatable', () => {
    const again = buildSepticSolids(kernel, canonicalModel());
    for (const component of built.components) {
      const other = again.components.find((entry) => entry.role === component.role);
      assert.ok(other, `missing ${component.role} in the second build`);
      assert.ok(Math.abs(other.volumeM3 - component.volumeM3) < 1e-12,
        `${component.role} volume changed between builds: ${component.volumeM3} vs ${other.volumeM3}`);
    }
  });

  it('13. reports which kernel overloads were used', () => {
    assert.ok(Object.keys(built.overloads).length >= 5,
      `overload log is too small: ${JSON.stringify(built.overloads)}`);
    // Recorded so the documentation can state the pinned signatures.
    console.log('kernel overloads:', JSON.stringify(built.overloads, null, 2));
    console.log('components:', built.components.map((c) =>
      `${c.role}=${c.volumeM3.toFixed(6)}m3/${c.solidCount} solid(s)`).join(', '));
  });
});
