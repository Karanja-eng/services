// Acceptance tests for the analysis -> view-model adapter (Task E2/E3/E4/E7).
//
// Run with: node test/analysis-viewmodel.test.mjs
//
// The view model is plain data, so these tests check the numbers a 2D or 3D view would
// draw: diagram ordinates at member ends, deformed coordinates, the deformation scale
// affecting display only, reaction directions, colour mapping, load-case selection, and
// the refusal to turn missing results into zeros.
//
// The analysis results fixture is produced by the real OpenSees run
// (test_cad_ifc_analysis.py writes .test-artifacts/analysis/*.result.json); if those
// files are absent this test builds the fixture from the same closed-form values and says
// so, so it never silently pretends to have run the engine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ViewModelError, buildViewModel, colourFor } from '../src/analysis/viewModel.mjs';

const WORK = path.resolve('.test-artifacts/analysis');

/** A normalised-result document in the shape `analysis.analyse()` returns. */
function fixture({ withSampledMoment = false } = {}) {
  const L = 6.0;
  const W = 20000.0;
  return {
    schema: 'fundi.analysis.results/1',
    ok: true,
    model_id: 'beam-benchmark',
    units: { length: 'm', force: 'N', moment: 'N*m', stress: 'Pa', area: 'm^2', inertia: 'm^4', angle: 'rad' },
    sign_convention: {
      reactions: 'positive in the positive axis direction',
      memberForces: 'local i->j frame, N positive in tension',
    },
    cases: [
      {
        case_id: 'udl',
        analysis: { formulation: 'linear elastic, first-order (small displacement)' },
        nodes: [
          { tag: 1, x: 0, y: 0 },
          { tag: 2, x: L / 2, y: 0 },
          { tag: 3, x: L, y: 0 },
        ],
        displacements: {
          'beam.node.start': { node: 1, ux: 0, uy: 0, rz: -0.004 },
          'beam.node.mid': { node: 2, ux: 0, uy: -0.016071429, rz: 0 },
          'beam.node.end': { node: 3, ux: 0, uy: 0, rz: 0.004 },
        },
        reactions: {
          node1: { node: 1, Fx: 0, Fy: W * L / 2, Mz: 0 },
          node3: { node: 3, Fx: 0, Fy: W * L / 2, Mz: 0 },
        },
        members: {
          'beam.member.left': {
            element: 1, i: 1, j: 2, length: L / 2,
            N_i: 0, V_i: 60000, M_i: 0, N_j: 0, V_j: -0, M_j: -90000,
          },
          'beam.member.right': {
            element: 2, i: 2, j: 3, length: L / 2,
            N_i: 0, V_i: 60000, M_i: 90000, N_j: 0, V_j: 0, M_j: 0,
          },
        },
        ...(withSampledMoment
          ? {
              diagrams: [
                {
                  member_id: 'beam.member.left',
                  points: [
                    { x: 1.5, V: 30000, M: 67500, N: 0 },
                    { x: 3.0, V: 0, M: 90000, N: 0 },
                  ],
                },
              ],
            }
          : {}),
      },
      {
        case_id: 'empty',
        analysis: {},
        displacements: {},
        reactions: {},
        members: {},
      },
    ],
    nodes: [
      { tag: 1, x: 0, y: 0, canonicalId: 'beam.node.start' },
      { tag: 2, x: L / 2, y: 0, canonicalId: 'beam.node.mid' },
      { tag: 3, x: L, y: 0, canonicalId: 'beam.node.end' },
    ],
  };
}

describe('analysis view model', () => {
  it('maps members and diagrams by canonical id', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl' });
    assert.equal(view.schema, 'fundi.viewmodel.analysis/1');
    assert.equal(view.dimensionality, 2);
    assert.deepEqual(Object.keys(view.diagrams.moment).sort(),
      ['0', '1']);
    assert.equal(view.members.length, 2);
    assert.equal(view.members[0].id, 'beam.member.left');

    // A 2D analysis must not be presented as a 3D result.
    assert.match(view.analysisFormulation, /first-order/);
    assert.equal(view.units.moment, 'N*m');
  });

  it('puts the correct ordinates at member ends', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl' });
    const left = view.diagrams.moment.find((d) => d.memberId === 'beam.member.left');
    const right = view.diagrams.moment.find((d) => d.memberId === 'beam.member.right');

    // Simply supported: zero at the supports, wL^2/8 at midspan.
    assert.equal(left.points[0].value, 0);
    assert.equal(left.points[1].value, -90000);
    assert.equal(right.points[0].value, 90000);
    assert.equal(right.points[1].value, 0);
    assert.equal(left.maxAbs, 90000);

    const shear = view.diagrams.shear.find((d) => d.memberId === 'beam.member.left');
    assert.equal(shear.points[0].value, 60000);
    assert.equal(shear.interpolation, 'linear');
  });

  it('never fabricates an interior moment maximum', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl' });
    const moment = view.diagrams.moment[0];
    assert.equal(moment.source, 'end-forces-only');
    assert.equal(moment.interpolation, 'none');
    assert.ok(
      view.warnings.some((warning) => warning.includes('interior maximum')),
      `expected a warning about the missing interior maximum, got ${JSON.stringify(view.warnings)}`,
    );
  });

  it('uses sampled diagrams when the analysis provides them', () => {
    const view = buildViewModel(fixture({ withSampledMoment: true }), { caseId: 'udl' });
    const sampled = view.diagrams.moment.find((d) => d.memberId === 'beam.member.left');
    assert.equal(sampled.source, 'sampled');
    assert.equal(sampled.points.length, 2);
    assert.equal(sampled.maxAbs, 90000);
    // The sampled member needs no warning; the un-sampled one still warns.
    assert.equal(view.warnings.filter((w) => w.includes('beam.member.left')).length, 0);
    assert.ok(view.warnings.some((w) => w.includes('beam.member.right')));
  });

  it('applies the deformation scale to display only', () => {
    const raw = buildViewModel(fixture(), { caseId: 'udl', deformationScale: 1 });
    const scaled = buildViewModel(fixture(), { caseId: 'udl', deformationScale: 50 });

    const midRaw = raw.nodes.find((n) => n.id === 'beam.node.mid');
    const midScaled = scaled.nodes.find((n) => n.id === 'beam.node.mid');

    // The stored engineering displacement is identical...
    assert.equal(midRaw.displacement.uy, midScaled.displacement.uy);
    // ...only the display coordinate changes.
    assert.equal(midRaw.display.y, -0.016071429);
    assert.ok(Math.abs(midScaled.display.y - -0.80357145) < 1e-9,
      `scaled display y = ${midScaled.display.y}`);
    assert.equal(scaled.deformation.exaggerated, true);
    assert.equal(raw.deformation.exaggerated, false);
    assert.match(scaled.deformation.note, /stored displacements are unchanged/);
  });

  it('builds reaction directions without scaling the force', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl' });
    assert.equal(view.reactions.length, 2);
    for (const reaction of view.reactions) {
      assert.equal(reaction.forces.Fy, 60000);
      assert.equal(reaction.magnitude, 60000);
      // Upward reaction -> unit direction +y, not the force magnitude.
      assert.equal(reaction.direction.x, 0);
      assert.equal(reaction.direction.y, 1);
    }
  });

  it('selects the requested load case and rejects unknown ones', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl' });
    assert.equal(view.caseId, 'udl');
    assert.throws(() => buildViewModel(fixture(), { caseId: 'nope' }), ViewModelError);
    // A default is only the first case, never an invented one.
    assert.equal(buildViewModel(fixture()).caseId, 'udl');
  });

  it('refuses to turn missing results into zeros', () => {
    // An empty case must fail loudly. The existing SteelAnalysisAdapter returns
    // {maxMoment: 0, maxShear: 0} here, which a design check would accept.
    assert.throws(() => buildViewModel(fixture(), { caseId: 'empty' }),
      (error) => error instanceof ViewModelError && /no member results/.test(error.message));

    assert.throws(() => buildViewModel({ cases: [] }), ViewModelError);

    const broken = fixture();
    broken.cases[0].members['beam.member.left'].M_j = null;
    assert.throws(() => buildViewModel(broken), /missing or non-finite M_j/);
  });

  it('rejects an invalid deformation scale rather than defaulting', () => {
    for (const scale of [0, -1, Number.NaN]) {
      assert.throws(() => buildViewModel(fixture(), { deformationScale: scale }), ViewModelError);
    }
  });

  it('colours members by the selected result with a legend', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl', colourBy: 'moment' });
    assert.equal(view.colouring.key, 'moment');
    assert.equal(view.colouring.max, 90000);
    assert.equal(view.colouring.unit, 'N*m');
    assert.equal(view.colouring.byMember['beam.member.left'].normalised, 1);
    assert.match(view.colouring.byMember['beam.member.left'].colour, /^rgb\(/);
    assert.equal(view.colouring.legend.stops.length, 3);

    const shear = buildViewModel(fixture(), { caseId: 'udl', colourBy: 'shear' });
    assert.equal(shear.colouring.unit, 'N');
    assert.throws(() => buildViewModel(fixture(), { colourBy: 'torsion' }), ViewModelError);
  });

  it('colour ramp is bounded and monotonic in value', () => {
    assert.equal(colourFor(0), 'rgb(49, 130, 246)');
    assert.equal(colourFor(1), 'rgb(239, 68, 68)');
    // Out-of-range input is clamped, never extrapolated.
    assert.equal(colourFor(-5), colourFor(0));
    assert.equal(colourFor(9), colourFor(1));
  });

  it('exposes deformed and undeformed geometry for both views', () => {
    const view = buildViewModel(fixture(), { caseId: 'udl', deformationScale: 20 });
    const member = view.members[0];
    assert.equal(member.undeformed.length, 2);
    assert.equal(member.deformed.length, 2);
    // Undeformed geometry is the original span; deformed follows the scaled nodes.
    assert.deepEqual(member.undeformed, [{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    assert.ok(member.deformed[1].y < -0.3, `deformed mid node y = ${member.deformed[1].y}`);
    assert.ok(view.nodes.every((node) => node.position && node.display));
  });

  it('reports the engine results file when one is available', () => {
    // If the Python suite has run, a normalised result document exists; assert the view
    // model can consume it, so the contract is not only satisfied by the fixture. The raw
    // runner output (`*.result.json`, schema fundi.analysis.result/1) is deliberately not
    // used: the view model consumes the normalised `fundi.analysis.results/1` contract.
    const candidates = fs.existsSync(WORK)
      ? fs.readdirSync(WORK).filter((name) => name.endsWith('analysis.json'))
      : [];
    if (candidates.length === 0) {
      console.log(
        'note: no normalised analysis result present; run test_cad_ifc_analysis.py then ' +
          'regenerate .test-artifacts/analysis/*.analysis.json to verify against engine output',
      );
      return;
    }
    const file = path.join(WORK, candidates[0]);
    const results = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(results.schema, 'fundi.analysis.results/1',
      `${candidates[0]} is not a normalised analysis document`);
    const view = buildViewModel(results);
    assert.ok(view.members.length > 0, 'engine results produced no members');
    assert.ok(view.diagrams.shear.every((entry) => Number.isFinite(entry.maxAbs)));
    assert.ok(view.nodes.every((node) => Number.isFinite(node.position.x)),
      'node coordinates were not carried into the view model');
    console.log(`verified against engine result: ${path.basename(file)} ` +
      `(${view.members.length} members, case ${view.caseId})`);
  });
});
