/**
 * Tests for the 3D branch of the analysis view model.
 *
 * The fixture is a **real** `POST /api/cad-ifc/analysis {dimensions: 3}` response for
 * the cantilever that `test_analysis3d.py` verifies against the closed-form
 * solution (L = 3 m, tip load -1000 N in Z), captured from the running backend.
 * Using the real document means the adapter is tested against the actual field
 * names, local axes and force ordering rather than a hand-written shape.
 */

import fs from 'fs';
import path from 'path';
import { buildViewModel3D } from '../viewModel3D.mjs';

const fixturePath = path.join(__dirname, 'fixtures', 'cantilever3d.results.json');
const results = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

describe('the 3D fixture is genuinely three-dimensional', () => {
  test('declares 3D, 6 DOF and a 3D formulation', () => {
    expect(results.dimensionality).toBe(3);
    expect(results.degreesOfFreedom).toBe(6);
    expect(results.cases[0].analysis.formulation).toMatch(/3D/);
    expect(results.cases[0].members.m1.localAxes).toBeTruthy();
  });
});

describe('buildViewModel3D — 3D dispatch', () => {
  const view = buildViewModel3D(results, { caseId: 'TIP-1', deformationScale: 100 });

  test('reports 3D and an identity frame mapping', () => {
    expect(view.dimensionality).toBe(3);
    expect(view.coordinateMapping.mapping).toMatch(/identity/);
    expect(view.cases).toEqual(['TIP-1']);
  });

  test('exposes only the components the 3D engine returns', () => {
    expect(Object.keys(view.diagramUnits).sort()).toEqual(
      ['axial', 'moment', 'momentY', 'shear', 'shearZ', 'torsion'].sort()
    );
    expect(view.diagramUnits.moment).toBe('N*m');
    expect(view.diagramUnits.shear).toBe('N');
    expect(view.activeDiagram).toBe('moment');
  });

  test('geometry is in the canonical frame (x along the member, y = 0, z = 0)', () => {
    const member = view.undeformed[0];
    expect(member.memberId).toBe('m1');
    expect(member.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(member.points[1].x).toBeCloseTo(3);
    expect(member.points[1].y).toBeCloseTo(0);
    expect(member.points[1].z).toBeCloseTo(0);
  });

  test('the deformed shape uses the scaled 3D displacement', () => {
    const tip = view.deformed[0].points[1];
    // The engine returned uz = -3.214e-4 m; x100 display scale.
    expect(tip.z).toBeCloseTo(-0.0321428571428571, 6);
    expect(tip.x).toBeCloseTo(3);
    expect(view.deformation.scale).toBe(100);
    expect(view.deformation.exaggerated).toBe(true);
  });
});

describe('buildViewModel3D — 3D diagrams', () => {
  // The fixture is a cantilever along global X with a tip load in global -Z. The
  // member's local y is global +Y and local z is global +Z, so the bending is about
  // the LOCAL Y axis (My = -3000 N*m at the fixed end) and the shear is LOCAL Vz.
  // Asserting both the loaded and the unloaded component is what proves the mapping
  // is not just "some number in some slot".
  test('the bending moment about local y is offset along local z', () => {
    const view = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'momentY' });
    const entry = view.diagrams.momentY[0];
    expect(entry.component).toBe('momentY');
    const values = entry.points.map((point) => point.value);
    expect(values[0]).toBeCloseTo(-3000, 6);
    expect(values[1]).toBeCloseTo(0, 6);
    expect(Math.abs(entry.geometry[0].z)).toBeGreaterThan(0);
    expect(entry.geometry[0].y).toBeCloseTo(0, 9);
    expect(entry.source).toBe('end-forces-only');
    expect(entry.warning).toMatch(/end forces only/);
  });

  test('the moment about local z is zero for this load, so its diagram is flat', () => {
    const view = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'moment' });
    const entry = view.diagrams.moment[0];
    expect(entry.points.map((point) => point.value)).toEqual([0, 0]);
    expect(entry.geometry[0].y).toBeCloseTo(0, 9);
    expect(entry.geometry[0].z).toBeCloseTo(0, 9);
  });

  test('shear is carried by the local z component, not the local y one', () => {
    const shearZ = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'shearZ' });
    expect(shearZ.diagramUnits.shearZ).toBe('N');
    const shearValues = shearZ.diagrams.shearZ[0].points.map((point) => point.value);
    expect(shearValues[0]).toBeCloseTo(1000, 6);
    expect(shearValues[1]).toBeCloseTo(-1000, 6);

    const shearY = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'shear' });
    expect(shearY.diagrams.shear[0].points.map((point) => point.value)).toEqual([0, 0]);
  });

  test('axial force and torsion are exposed and zero for this load', () => {
    const axial = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'axial' });
    expect(axial.diagrams.axial[0].points.map((point) => point.value)).toEqual([0, 0]);
    const torsion = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'torsion' });
    expect(torsion.diagrams.torsion[0].points.map((point) => point.value)).toEqual([0, 0]);
    expect(torsion.diagramUnits.torsion).toBe('N*m');
  });

  test('an unknown diagram falls back to the moment diagram', () => {
    const view = buildViewModel3D(results, { caseId: 'TIP-1', diagram: 'deflection' });
    expect(view.activeDiagram).toBe('moment');
  });

  test('the warnings say that 3D diagrams are end-force only', () => {
    const view = buildViewModel3D(results, { caseId: 'TIP-1' });
    expect(view.warnings.join(' ')).toMatch(/end forces only/);
    expect(view.diagramScale.displayOnly).toBe(true);
  });
});

describe('buildViewModel3D — 3D reactions and supports', () => {
  test('reaction vectors are 3D and carry the reaction moment', () => {
    const view = buildViewModel3D(results, { caseId: 'TIP-1' });
    const reaction = view.reactions[0];
    expect(reaction.magnitude).toBeCloseTo(1000, 6);
    expect(reaction.forces.Fz).toBeCloseTo(1000, 6);
    expect(reaction.forces.My).toBeCloseTo(-3000, 3);
    expect(reaction.label).toBe('1.0 kN');
    // Upward reaction: the tip of the arrow is above (canonical +Z) the origin.
    expect(reaction.tip.z).toBeGreaterThan(reaction.origin.z);
  });

  test('supports come from the declared six restraints', () => {
    const view = buildViewModel3D(results, { caseId: 'TIP-1' });
    expect(view.supports).toHaveLength(1);
    expect(view.supports[0].fixed).toBe(true);
    expect(view.supports[0].restraints).toEqual({
      ux: true, uy: true, uz: true, rx: true, ry: true, rz: true,
    });
  });
});

describe('buildViewModel3D — 3D input guards', () => {
  test('an unknown case is refused with the available cases listed', () => {
    expect(() => buildViewModel3D(results, { caseId: 'NOPE' })).toThrow(/NOPE/);
  });

  test('a non-positive deformation scale is refused', () => {
    expect(() => buildViewModel3D(results, { caseId: 'TIP-1', deformationScale: -5 })).toThrow(
      /positive/
    );
  });
});
