/**
 * Unit tests for the 3D analysis view model.
 *
 * The fixture mirrors a real `POST /api/cad-ifc/analysis` response for the beam
 * generator (two subdivided elements, simply supported, UDL), reduced to the keys
 * the adapter reads. The assertions lock down the two things that could silently
 * mislead an engineer:
 *
 *   1. the solver plane -> canonical frame mapping (Y up -> Z up), and
 *   2. refusal to display a payload that is not real solver output.
 */

import {
  ANALYTICAL_COORDINATE_MAPPING,
  buildViewModel3D,
  solverPointToCanonical,
  unwrapAnalysisResults,
} from '../viewModel3D.mjs';

const results = {
  schema: 'fundi.analysis.results/1',
  model_id: 'beam',
  engine: { name: 'OpenSees', version: 'OpenSeesPy' },
  units: {
    length: 'm',
    force: 'N',
    moment: 'N*m',
    stress: 'Pa',
    area: 'm^2',
    inertia: 'm^4',
    angle: 'rad',
  },
  sign_convention: {
    axes: 'global X right, Y up, Z out of plane (right-handed), as in the engine',
    memberForces: 'local axes: N positive in tension',
  },
  nodes: [
    { tag: 1, x: 0, y: 0, canonicalId: 'beam.beam#n0' },
    { tag: 2, x: 1.5, y: 0, canonicalId: 'beam.beam#n1' },
    { tag: 3, x: 3, y: 0, canonicalId: 'beam.beam#n2' },
  ],
  cases: [
    {
      case_id: 'ULS-1',
      analysis: { type: 'static', formulation: 'linear elastic, first-order (small displacement)' },
      displacements: {
        'beam.beam#n0': { node: 1, ux: 0, uy: 0, rz: 0 },
        'beam.beam#n1': { node: 2, ux: 0, uy: -0.001, rz: -0.0005 },
        'beam.beam#n2': { node: 3, ux: 0, uy: 0, rz: 0.001 },
      },
      reactions: {
        node1: { node: 1, Fx: 0, Fy: 50000, Mz: 0 },
        node3: { node: 3, Fx: 0, Fy: 50000, Mz: 0 },
      },
      members: {
        'beam.beam#e0': {
          element: 1, section_id: 'C30/37', i: 1, j: 2, length: 1.5,
          N_i: 0, V_i: 50000, M_i: 0, N_j: 0, V_j: -50000, M_j: 75000,
        },
        'beam.beam#e1': {
          element: 2, section_id: 'C30/37', i: 2, j: 3, length: 1.5,
          N_i: 0, V_i: 50000, M_i: -75000, N_j: 0, V_j: -50000, M_j: 0,
        },
      },
      supports: [
        { node: 'beam.beam#n0', ux: true, uy: true, rz: false },
        { node: 'beam.beam#n2', ux: false, uy: true, rz: false },
      ],
      equilibrium: { residualRelative: 1e-12 },
    },
  ],
};

describe('solver plane -> canonical frame', () => {
  test('the mapping is declared, not implied', () => {
    expect(ANALYTICAL_COORDINATE_MAPPING.mapping).toBe('(sx, sy) -> (x = sx, y = 0, z = sy)');
    expect(solverPointToCanonical({ x: 2, y: 3 })).toEqual({ x: 2, y: 0, z: 3 });
  });

  test('undeformed geometry lies in the canonical X-Z plane', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', deformationScale: 1 });
    for (const member of view.undeformed) {
      for (const point of member.points) {
        expect(point.y).toBe(0);
      }
    }
    const first = view.undeformed[0].points;
    expect(first[0].x).toBeCloseTo(0);
    expect(first[1].x).toBeCloseTo(1.5);
    expect(first[0].z).toBeCloseTo(0);
  });
});

describe('deformation display', () => {
  test('deflection is drawn on the canonical vertical axis', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', deformationScale: 100 });
    const middle = view.deformed[0].points[1];
    // uy = -0.001 m, scaled x100 -> -0.1 m on the canonical Z axis.
    expect(middle.z).toBeCloseTo(-0.1);
    expect(middle.y).toBe(0);
    expect(view.deformation.exaggerated).toBe(true);
    expect(view.deformation.scale).toBe(100);
  });

  test('scale 1 is reported as not exaggerated and still uses the raw value', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', deformationScale: 1 });
    expect(view.deformation.exaggerated).toBe(false);
    expect(view.deformed[0].points[1].z).toBeCloseTo(-0.001);
  });

  test('an invalid scale is rejected instead of silently clamped', () => {
    expect(() => buildViewModel3D(results, { deformationScale: 0 })).toThrow(/positive/);
  });
});

describe('force diagrams', () => {
  test('the moment diagram is offset vertically and keeps solver values', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', diagram: 'moment' });
    expect(view.activeDiagram).toBe('moment');
    const entry = view.diagrams.moment[0];
    expect(entry.component).toBe('moment');
    // End moments 0 and 75 kNm, nothing sampled in between.
    expect(entry.points.map((point) => point.value)).toEqual([0, 75000]);
    // A diagram point with a non-zero value must leave the member axis in Z.
    const offset = entry.geometry[1];
    expect(Math.abs(offset.z)).toBeGreaterThan(0);
    expect(offset.y).toBe(0);
    expect(view.diagramScale.displayOnly).toBe(true);
    expect(view.diagramScale.offsetPerUnit).toBeGreaterThan(0);
  });

  test('end-only moment data is flagged, not interpolated', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', diagram: 'moment' });
    expect(view.warnings.join(' ')).toMatch(/no sampled moment diagram/);
  });

  test('shear is drawn with the force unit', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', diagram: 'shear' });
    expect(view.diagramUnits.shear).toBe('N');
    expect(view.diagrams.shear[0].points.map((point) => point.value)).toEqual([50000, -50000]);
  });

  test('an unknown diagram falls back to moment without inventing a component', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1', diagram: 'torsion' });
    expect(view.activeDiagram).toBe('moment');
  });
});

describe('reactions and supports', () => {
  test('reaction vectors leave the support in the direction of the force', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1' });
    expect(view.reactions).toHaveLength(2);
    const reaction = view.reactions[0];
    expect(reaction.magnitude).toBeCloseTo(50000);
    expect(reaction.label).toBe('50.0 kN');
    expect(reaction.origin.z).toBeCloseTo(0);
    expect(reaction.tip.z).toBeGreaterThan(reaction.origin.z);
  });

  test('supports come from the declared restraints, not from the reactions', () => {
    const view = buildViewModel3D(results, { caseId: 'ULS-1' });
    expect(view.supports).toHaveLength(2);
    expect(view.supports[0].fixed).toBe(false);
    expect(view.supports[0].restraints).toEqual({ ux: true, uy: true, rz: false });
  });
});

describe('payload guard', () => {
  test('accepts the /analysis envelope', () => {
    expect(unwrapAnalysisResults({ ok: true, results })).toBe(results);
  });

  test('accepts the bare results document', () => {
    expect(unwrapAnalysisResults(results)).toBe(results);
  });

  test('refuses a payload with no cases', () => {
    expect(() => unwrapAnalysisResults({ results: { cases: [] } })).toThrow(/load cases/);
  });

  test('refuses results with no declared units or sign convention', () => {
    const stripped = { ...results, units: undefined };
    expect(() => unwrapAnalysisResults(stripped)).toThrow(/units\/sign convention/);
    const noSign = { ...results, sign_convention: undefined };
    expect(() => unwrapAnalysisResults(noSign)).toThrow(/units\/sign convention/);
  });

  test('refuses nothing at all', () => {
    expect(() => unwrapAnalysisResults(null)).toThrow(/no analysis payload/);
  });
});
