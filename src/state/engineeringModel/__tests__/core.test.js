/**
 * Unit tests for the canonical engineering model core.
 *
 * These cover the invariants the unified workbench depends on:
 * stable ids, validation before acceptance, revision/fingerprint tracking,
 * identity mapping across CAD/IFC, and analysis-result staleness.
 */

import {
  analysisReadiness,
  analysisStatus,
  applyEdit,
  attachAnalysisResults,
  buildIdentityIndex,
  createEngineeringModel,
  createMember,
  createNode,
  editElementGeometry,
  elementAxisGeometry,
  elementExtent,
  fingerprintModel,
  fromCanonicalDocument,
  hasUnsavedChanges,
  markSaved,
  metresToMillimetres,
  millimetresToMetres,
  nodeToSolverCoordinates,
  resolveElementId,
  toCanonicalDocument,
  validateEngineeringModel,
} from '../core';

const minimalModel = () =>
  createEngineeringModel({
    modelId: 'test',
    sections: [{ id: 'S1', area: 0.18, inertia: 0.0054 }],
    materials: [{ id: 'M1', youngsModulusPa: 30e9 }],
  });

/** A two-node, one-member inline model built through a validated edit. */
function withBeam(model) {
  const outcome = applyEdit(model, (draft) => {
    draft.nodes.push(createNode({ id: 'n1', x: 0, y: 0, z: 0 }));
    draft.nodes.push(createNode({ id: 'n2', x: 6, y: 0, z: 0 }));
    draft.members.push(
      createMember({
        id: 'b1',
        startNodeId: 'n1',
        endNodeId: 'n2',
        sectionId: 'S1',
        materialId: 'M1',
        ifcGlobalId: '0YvctgSJr4xv5uCq9pQm3K',
        ifcClass: 'IfcBeam',
        cadHandles: ['2A1'],
      })
    );
    draft.supports.push({ nodeId: 'n1', ux: true, uy: true, rz: false });
    draft.supports.push({ nodeId: 'n2', ux: false, uy: true, rz: false });
    draft.loads.push({ id: 'L1', kind: 'element', memberId: 'b1', wy: -20000 });
    draft.analysisCases.push({ id: 'ULS-1', kind: 'static' });
  }, { reason: 'test beam' });
  if (!outcome.ok) throw new Error(`fixture invalid: ${outcome.report.errors.join('; ')}`);
  return outcome.model;
}

describe('units and coordinates', () => {
  test('the model declares metres and Z-up', () => {
    const model = minimalModel();
    expect(model.units.length).toBe('m');
    expect(model.coordinates.up).toBe('Z');
  });

  test('unit conversions are explicit', () => {
    expect(metresToMillimetres(6.7)).toBeCloseTo(6700);
    expect(millimetresToMetres(6700)).toBeCloseTo(6.7);
  });

  test('solver mapping refuses a frame it cannot honestly map', () => {
    const model = minimalModel();
    expect(nodeToSolverCoordinates(model, { x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
    const yUp = { ...model, coordinates: { ...model.coordinates, up: 'Y' } };
    expect(() => nodeToSolverCoordinates(yUp, { x: 0, y: 0, z: 0 })).toThrow(/Z-up solver frame/);
    const feet = { ...model, units: { ...model.units, length: 'ft' } };
    expect(() => nodeToSolverCoordinates(feet, { x: 0, y: 0, z: 0 })).toThrow(/metre frame/);
  });
});

describe('validation', () => {
  test('an empty model is valid but not analysable', () => {
    const model = minimalModel();
    expect(validateEngineeringModel(model).ok).toBe(true);
    const readiness = analysisReadiness(model);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(' ')).toMatch(/no members/);
  });

  test('duplicate ids and dangling references are errors', () => {
    const model = minimalModel();
    const report = validateEngineeringModel({
      ...model,
      nodes: [
        { id: 'n1', x: 0, y: 0, z: 0 },
        { id: 'n1', x: 1, y: 0, z: 0 },
      ],
      members: [{ id: 'm1', startNodeId: 'n1', endNodeId: 'ghost' }],
    });
    expect(report.ok).toBe(false);
    expect(report.errors.join(' ')).toMatch(/duplicate node id n1/);
    expect(report.errors.join(' ')).toMatch(/unknown node ghost/);
  });

  test('a member with no section is valid geometry with a warning', () => {
    const model = minimalModel();
    const outcome = applyEdit(model, (draft) => {
      draft.nodes.push(createNode({ id: 'a', x: 0, y: 0, z: 0 }));
      draft.nodes.push(createNode({ id: 'b', x: 3, y: 0, z: 0 }));
      draft.members.push(createMember({ id: 'm', startNodeId: 'a', endNodeId: 'b' }));
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.report.warnings.join(' ')).toMatch(/no section assigned/);
    expect(analysisReadiness(outcome.model).blockers.join(' ')).toMatch(/has no section/);
  });

  test('a support that restrains nothing is rejected', () => {
    const model = minimalModel();
    const report = validateEngineeringModel({
      ...model,
      nodes: [{ id: 'n1', x: 0, y: 0, z: 0 }],
      supports: [
        { nodeId: 'n1', ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
      ],
    });
    expect(report.ok).toBe(false);
    expect(report.errors.join(' ')).toMatch(/restrains nothing/);
  });
});

describe('editing, revisions and identity', () => {
  test('an accepted edit bumps the revision and keeps the ids', () => {
    const model = withBeam(minimalModel());
    expect(model.revision.index).toBe(1);
    expect(model.nodes.map((node) => node.id)).toEqual(['n1', 'n2']);

    const edited = applyEdit(model, (draft) => {
      draft.members[0].sectionId = 'S1';
      draft.members.push(
        createMember({ id: 'b2', startNodeId: 'n2', endNodeId: 'n1', sectionId: 'S1' })
      );
    });
    expect(edited.ok).toBe(true);
    expect(edited.model.revision.index).toBe(2);
    expect(edited.model.members.map((member) => member.id)).toEqual(['b1', 'b2']);
    expect(edited.model.members[0].ifcGlobalId).toBe('0YvctgSJr4xv5uCq9pQm3K');
    expect(edited.model.members[0].cadHandles).toEqual(['2A1']);
  });

  test('an invalid edit is rejected and the model is unchanged', () => {
    const model = withBeam(minimalModel());
    const outcome = applyEdit(model, (draft) => {
      draft.members[0].endNodeId = 'does-not-exist';
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.model).toBe(model);
    expect(outcome.report.errors.join(' ')).toMatch(/unknown node does-not-exist/);
    expect(model.revision.index).toBe(1);
  });

  test('the fingerprint ignores presentation state but tracks engineering data', () => {
    const model = withBeam(minimalModel());
    const before = fingerprintModel(model);
    expect(fingerprintModel({ ...model, hidden: ['b1'] })).toBe(before);
    const changedSection = {
      ...model,
      sections: [{ id: 'S1', area: 0.2, inertia: 0.006 }],
    };
    expect(fingerprintModel(changedSection)).not.toBe(before);
  });

  test('unsaved changes are tracked explicitly', () => {
    // A fresh model is saved; an applied edit makes it dirty until it is saved.
    expect(hasUnsavedChanges(minimalModel())).toBe(false);
    const model = withBeam(minimalModel());
    expect(hasUnsavedChanges(model)).toBe(true);
    const saved = markSaved(model);
    expect(hasUnsavedChanges(saved)).toBe(false);
    const edited = applyEdit(saved, (draft) => {
      draft.nodes[0].z = 1;
    }).model;
    expect(hasUnsavedChanges(edited)).toBe(true);
    expect(edited.revision.index).toBe(model.revision.index + 1);
  });

  test('identity resolves a GlobalId, a CAD handle and a solver key to one element', () => {
    const model = withBeam(minimalModel());
    expect(resolveElementId(model, '0YvctgSJr4xv5uCq9pQm3K', 'ifc')).toBe('b1');
    expect(resolveElementId(model, '2A1', 'cad')).toBe('b1');
    expect(resolveElementId(model, 'b1#n1')).toBe('b1');
    expect(resolveElementId(model, 'nope')).toBeNull();
  });

  test('the identity index tolerates both backend and model field names', () => {
    const index = buildIdentityIndex({
      members: [{ id: 'm1', ifcGlobalId: 'G1', cadHandles: ['F1'] }],
      elements: [{ id: 'e1', ifc_guid: 'G2', ifc_class: 'IfcBeam', cad_handles: ['F2'] }],
    });
    expect(index.byGlobalId).toEqual({ G1: 'm1', G2: 'e1' });
    expect(index.byHandle).toEqual({ F1: 'm1', F2: 'e1' });
    expect(index.entityCount).toBe(2);
  });
});

describe('analysis result association', () => {
  const solverResults = {
    schema: 'fundi.analysis.results/1',
    units: { length: 'm', force: 'N', moment: 'N*m' },
    sign_convention: { axes: 'X right, Y up' },
    engine: { name: 'OpenSees', version: 'OpenSeesPy' },
    nodes: [],
    cases: [{ case_id: 'ULS-1', members: {}, displacements: {}, reactions: {} }],
  };

  test('results are stamped with the revision that produced them', () => {
    const model = withBeam(minimalModel());
    const withResults = attachAnalysisResults(model, solverResults, { caseId: 'ULS-1' });
    expect(withResults.analysis.modelRevision).toBe(model.revision.index);
    expect(withResults.analysis.fingerprint).toBe(fingerprintModel(model));
    expect(analysisStatus(withResults).state).toBe('current');
  });

  test('a later model change makes the results stale, not deleted', () => {
    const model = withBeam(minimalModel());
    const withResults = attachAnalysisResults(model, solverResults);
    const edited = applyEdit(withResults, (draft) => {
      draft.members[0].sectionId = 'S1';
      draft.nodes[0].z = 1;
    }).model;
    const status = analysisStatus(edited);
    expect(status.state).toBe('stale');
    expect(status.reason).toMatch(/changed after this analysis/);
    // The results are still there — they were real when computed.
    expect(edited.analysis.results.cases).toHaveLength(1);
  });

  test('attaching results without load cases is refused', () => {
    const model = withBeam(minimalModel());
    expect(() => attachAnalysisResults(model, { cases: [] })).toThrow(/no load cases/);
  });

  test('no analysis reports its own state', () => {
    expect(analysisStatus(withBeam(minimalModel())).state).toBe('none');
  });
});

describe('backend canonical document adapter', () => {
  // Shape verified against GET /api/cad-ifc/model/beam (see the execution journal).
  const document = {
    schema: 'fundi.canonical/1',
    model_id: 'beam',
    name: 'Suspended beam',
    generator: 'beam',
    levels: [{ id: 'beam:L0', name: 'Level 1', elevation: 0 }],
    elements: [
      {
        id: 'beam.beam',
        element_type: 'beam',
        ifc_class: 'IfcBeam',
        name: 'Suspended beam',
        axis: 'x',
        dimensions: { length_x: 6.7, width_y: 0.3, height_z: 0.6 },
        placement: { x: 0, y: 0, z: 0.3 },
        rotation_z_deg: 0,
        material: 'C30/37',
        validation: { warnings: [] },
      },
    ],
  };

  test('element extents come from suffixed dimension keys', () => {
    expect(elementExtent(document.elements[0])).toEqual({ x: 6.7, y: 0.3, z: 0.6 });
  });

  test('the member axis is derived from placement and length, not guessed', () => {
    const geometry = elementAxisGeometry(document.elements[0]);
    expect(geometry.start.x).toBeCloseTo(-3.35);
    expect(geometry.end.x).toBeCloseTo(3.35);
    expect(geometry.start.z).toBeCloseTo(0.3);
    expect(geometry.end.z).toBeCloseTo(0.3);
  });

  test('import builds nodes, members and the generator element record', () => {
    const model = fromCanonicalDocument(document);
    expect(model.modelId).toBe('beam');
    expect(model.nodes.map((node) => node.id)).toEqual(['beam.beam#start', 'beam.beam#end']);
    expect(model.members).toHaveLength(1);
    expect(model.members[0].ifcClass).toBe('IfcBeam');
    expect(model.generatorElements[0].dimensions.height_z).toBe(0.6);
    expect(model.generatorElements[0].placement.z).toBe(0.3);
    expect(model.storeys[0].id).toBe('beam:L0');
    expect(model.validation.ok).toBe(true);
  });

  test('a solid element (slab) keeps its geometry but is not turned into a member', () => {
    const slabDocument = {
      ...document,
      elements: [
        {
          id: 'slab.slab',
          element_type: 'slab',
          ifc_class: 'IfcSlab',
          axis: 'z',
          dimensions: { length_x: 4, width_y: 3, thickness_z: 0.2 },
          placement: { x: 0, y: 0, z: 0.1 },
        },
      ],
    };
    const model = fromCanonicalDocument(slabDocument);
    expect(model.members).toHaveLength(0);
    expect(model.nodes.map((node) => node.id)).toEqual(['slab.slab#origin']);
    expect(model.generatorElements[0].dimensions.thickness_z).toBe(0.2);
    // A slab is modelled, but the 2D frame solver cannot analyse it — and says so.
    expect(analysisReadiness(model).ready).toBe(false);
    expect(analysisReadiness(model).blockers.join(' ')).toMatch(/no members/);
  });

  test('export round-trips the engineering blocks without unit changes', () => {
    const model = fromCanonicalDocument(document);
    const exported = toCanonicalDocument(model);
    expect(exported.schema).toBe('fundi.canonical/1');
    expect(exported.units.length).toBe('m');
    expect(exported.levels[0].id).toBe('beam:L0');
    expect(exported.elements[0].dimensions).toEqual(document.elements[0].dimensions);
    expect(exported.elements[0].ifc_guid).toBeNull();
  });
});

describe('element property editing', () => {
  const docFor = () => ({
    schema: 'fundi.canonical/1',
    model_id: 'beam',
    name: 'beam',
    levels: [{ id: 'beam:L0', name: 'Level 1', elevation: 0 }],
    elements: [
      {
        id: 'beam.beam',
        element_type: 'beam',
        ifc_class: 'IfcBeam',
        axis: 'x',
        dimensions: { length_x: 6.7, width_y: 0.3, height_z: 0.6 },
        placement: { x: 0, y: 0, z: 0.3 },
        rotation_z_deg: 0,
      },
    ],
  });

  test('an accepted geometry edit bumps the revision and moves the member with it', () => {
    const model = fromCanonicalDocument(docFor());
    const start = model.nodes.find((node) => node.id === 'beam.beam#start');
    const end = model.nodes.find((node) => node.id === 'beam.beam#end');

    const outcome = editElementGeometry(model, 'beam.beam', {
      dimensions: { height_z: 0.8 },
      placement: { z: 0.4 },
    });
    expect(outcome.ok).toBe(true);
    const edited = outcome.model;
    expect(edited.revision.index).toBe(model.revision.index + 1);
    expect(edited.generatorElements[0].dimensions.height_z).toBe(0.8);
    expect(edited.generatorElements[0].placement.z).toBe(0.4);
    // The member's derived end nodes follow the element, so the 3D view and the
    // analysis readiness check cannot disagree with the canonical record.
    expect(edited.nodes.find((node) => node.id === start.id).z).toBeCloseTo(0.4);
    expect(edited.nodes.find((node) => node.id === end.id).z).toBeCloseTo(0.4);
    expect(edited.history[edited.history.length - 1].reason).toMatch(/geometry edit/);
  });

  test('an impossible dimension is rejected and leaves the model untouched', () => {
    const model = fromCanonicalDocument(docFor());
    const outcome = editElementGeometry(model, 'beam.beam', { dimensions: { height_z: -1 } });
    expect(outcome.ok).toBe(false);
    expect(outcome.model).toBe(model);
    expect(outcome.report.errors.join(' ')).toMatch(/height_z must be a positive number/);
    expect(model.generatorElements[0].dimensions.height_z).toBe(0.6);
    expect(model.revision.index).toBe(0);
  });

  test('a non-finite placement is rejected', () => {
    const model = fromCanonicalDocument(docFor());
    const outcome = editElementGeometry(model, 'beam.beam', { placement: { x: Number.NaN } });
    expect(outcome.ok).toBe(false);
    expect(outcome.report.errors.join(' ')).toMatch(/placement x must be a finite number/);
  });

  test('editing an unknown element reports the reason instead of creating one', () => {
    const model = fromCanonicalDocument(docFor());
    const outcome = editElementGeometry(model, 'nope', { dimensions: { height_z: 1 } });
    expect(outcome.ok).toBe(false);
    expect(outcome.report.errors[0]).toMatch(/not part of this model/);
  });

  test('identity (GlobalId / CAD handle) survives an edit', () => {
    const model = withBeam(minimalModel());
    const before = model.identity;
    const edited = applyEdit(model, (draft) => {
      draft.nodes[0].x = -1;
    }).model;
    expect(edited.identity.byGlobalId).toEqual(before.byGlobalId);
    expect(edited.identity.byHandle).toEqual(before.byHandle);
    expect(edited.identity.byGlobalId['0YvctgSJr4xv5uCq9pQm3K']).toBe('b1');
  });

  test('a geometry edit makes attached analysis results stale', () => {
    const solverResults = {
      units: { length: 'm', force: 'N', moment: 'N*m' },
      sign_convention: { axes: 'x/y' },
      engine: { name: 'OpenSees' },
      nodes: [],
      cases: [{ case_id: 'ULS-1', members: {}, displacements: {}, reactions: {} }],
    };
    const model = attachAnalysisResults(fromCanonicalDocument(docFor()), solverResults);
    expect(analysisStatus(model).state).toBe('current');

    const edited = editElementGeometry(model, 'beam.beam', { dimensions: { width_y: 0.35 } });
    expect(edited.ok).toBe(true);
    expect(analysisStatus(edited.model).state).toBe('stale');
    // Stale results are kept, never deleted — they were real when computed.
    expect(edited.model.analysis.results.cases).toHaveLength(1);
  });
});
