/**
 * Tests for the Framed & Tall builder -> canonical model adapter.
 *
 * These lock down the contract that makes builder results revision-stampable:
 * a stable, order-independent fingerprint of the analysis inputs, and a model
 * conversion that preserves ids and does not invent engineering properties.
 */

import {
  BUILDER_RESULT_KIND,
  buildBuilderFingerprint,
  builderToCanonicalModel,
  unknownStoreyElevations,
} from '../builderModelAdapter';
import { analysisStatus, attachAnalysisDocument } from '../../../../state/engineeringModel/core';
import { buildCanonicalBoxes } from '../../../interop/modelGeometry';

const column = (id, x, y, extra = {}) => ({
  id,
  type: 'column',
  layer: 'Floor 1',
  position: { x, y, z: 0 },
  properties: { width: 0.45, depth: 0.45, height: 3.5, material: 'C30', ...extra },
});

const beam = (id, x0, y0, x1, y1, extra = {}) => ({
  id,
  type: 'beam',
  layer: 'Floor 1',
  position: { start: { x: x0, y: y0, z: 0 }, end: { x: x1, y: y1, z: 0 } },
  properties: { width: 0.3, depth: 0.6, material: 'C30', ...extra },
});

describe('buildBuilderFingerprint', () => {
  test('is stable for an unchanged structure', () => {
    const elements = [column('C1', 0, 0), beam('B1', 0, 0, 5, 0)];
    expect(buildBuilderFingerprint({ elements })).toBe(buildBuilderFingerprint({ elements }));
  });

  test('is independent of element order', () => {
    const a = [column('C1', 0, 0), beam('B1', 0, 0, 5, 0)];
    const b = [...a].reverse();
    expect(buildBuilderFingerprint({ elements: a })).toBe(buildBuilderFingerprint({ elements: b }));
  });

  test('changes when a section changes', () => {
    const base = [beam('B1', 0, 0, 5, 0)];
    const thicker = [beam('B1', 0, 0, 5, 0, { depth: 0.8 })];
    expect(buildBuilderFingerprint({ elements: base })).not.toBe(
      buildBuilderFingerprint({ elements: thicker })
    );
  });

  test('changes when geometry, material, load or method changes', () => {
    const base = [column('C1', 0, 0)];
    const fingerprint = buildBuilderFingerprint({ elements: base });
    expect(buildBuilderFingerprint({ elements: [column('C1', 1, 0)] })).not.toBe(fingerprint);
    expect(
      buildBuilderFingerprint({ elements: [column('C1', 0, 0, { material: 'C40' })] })
    ).not.toBe(fingerprint);
    expect(
      buildBuilderFingerprint({ elements: [column('C1', 0, 0, { load: 12 })] })
    ).not.toBe(fingerprint);
    expect(
      buildBuilderFingerprint({ elements: base, method: 'stiffness' })
    ).not.toBe(fingerprint);
  });

  test('changes when an element is added', () => {
    const one = buildBuilderFingerprint({ elements: [column('C1', 0, 0)] });
    const two = buildBuilderFingerprint({ elements: [column('C1', 0, 0), column('C2', 5, 0)] });
    expect(two).not.toBe(one);
  });
});

describe('builderToCanonicalModel', () => {
  const structure = () => [
    column('C1', 0, 0),
    column('C2', 5, 0, { height: 3.0 }),
    beam('B1', 0, 0, 5, 0),
  ];

  test('preserves element ids and creates members and nodes', () => {
    const { model } = builderToCanonicalModel({ elements: structure(), layers: ['Floor 1'] });
    expect(model.members.map((member) => member.id)).toEqual(['C1', 'C2', 'B1']);
    expect(model.nodes.map((node) => node.id)).toEqual([
      'C1#start',
      'C1#end',
      'C2#start',
      'C2#end',
      'B1#start',
      'B1#end',
    ]);
    expect(model.storeys[0].id).toBe('Floor 1');
    expect(model.validation.ok).toBe(true);
  });

  test('columns run vertically and the beam along X', () => {
    const { model } = builderToCanonicalModel({ elements: structure() });
    const c1 = model.generatorElements.find((element) => element.id === 'C1');
    expect(c1.axis).toBe('z');
    expect(c1.dimensions).toEqual({ width_x: 0.45, depth_y: 0.45, height_z: 3.5 });
    expect(c1.placement.z).toBeCloseTo(1.75);

    const b1 = model.generatorElements.find((element) => element.id === 'B1');
    expect(b1.axis).toBe('x');
    expect(b1.dimensions.length_x).toBeCloseTo(5);
    expect(b1.dimensions.height_z).toBeCloseTo(0.6);
  });

  test('the published geometry is drawable by the 3D adapter', () => {
    const { model } = builderToCanonicalModel({ elements: structure() });
    const { boxes, unresolved } = buildCanonicalBoxes(model);
    expect(unresolved).toHaveLength(0);
    expect(boxes.map((box) => box.id)).toEqual(['C1', 'C2', 'B1']);
    expect(boxes[0].size.z).toBeCloseTo(3.5);
    expect(boxes[2].size.x).toBeCloseTo(5);
  });

  test('sections are geometric and materials carry no invented E', () => {
    const { model, warnings } = builderToCanonicalModel({ elements: structure() });
    // Two distinct sections: 450×450 columns and the 300×600 beam.
    expect(model.sections).toHaveLength(2);
    const columnSection = model.sections.find((section) => section.id === 'sec-0.450x0.450');
    expect(columnSection.area).toBeCloseTo(0.45 * 0.45);
    expect(columnSection.inertia).toBeCloseTo((0.45 * 0.45 ** 3) / 12);

    const material = model.materials[0];
    expect(material.grade).toBe('C30');
    expect(material.youngsModulusPa).toBeNull();
    expect(warnings.join(' ')).toMatch(/no explicit E/);
  });

  test('supports and loads are not synthesised', () => {
    const { model } = builderToCanonicalModel({ elements: structure() });
    expect(model.supports).toHaveLength(0);
    expect(model.loads).toHaveLength(0);
  });

  test('a slab is published as a solid but not as a member', () => {
    const { model } = builderToCanonicalModel({
      elements: [
        {
          id: 'S1',
          type: 'slab',
          layer: 'Floor 1',
          position: { x: 2.5, y: 2.5, z: 3.5 },
          properties: { width: 5, depth: 5, thickness: 0.2, material: 'C30' },
        },
      ],
    });
    expect(model.members).toHaveLength(0);
    expect(model.generatorElements[0].dimensions).toEqual({
      length_x: 5,
      width_y: 5,
      thickness_z: 0.2,
    });
    expect(model.nodes.map((node) => node.id)).toEqual(['S1#origin']);
  });

  test('unusable elements are reported, not dropped silently', () => {
    const { skipped, warnings } = builderToCanonicalModel({
      elements: [
        { id: 'B0', type: 'beam', position: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }, properties: {} },
        { id: 'V1', type: 'void', properties: {} },
        { id: 'X1', type: 'foundation', properties: {} },
      ],
    });
    expect(skipped.map((entry) => entry.id)).toEqual(['B0', 'V1', 'X1']);
    expect(warnings.join(' ')).toMatch(/zero length/);
    expect(warnings.join(' ')).toMatch(/void/);
    expect(warnings.join(' ')).toMatch(/unsupported element type/);
  });

  test('storey elevations are reported as unknown rather than zero', () => {
    const { model } = builderToCanonicalModel({ elements: structure(), layers: ['Floor 1'] });
    expect(model.storeys[0].elevation).toBeNull();
    expect(unknownStoreyElevations(model)).toHaveLength(1);
  });

  test('an empty structure still produces a valid, empty model', () => {
    const { model } = builderToCanonicalModel({ elements: [] });
    expect(model.members).toHaveLength(0);
    expect(model.validation.ok).toBe(true);
  });
});

describe('builder results are revision-stamped', () => {
  test('stored under the tall-frame kind and current for the same structure', () => {
    const { model } = builderToCanonicalModel({ elements: [column('C1', 0, 0)] });
    const raw = [{ element_id: 'C1', N_max: 1200, M_max: 85, V_max: 40 }];

    const stamped = attachAnalysisDocument(model, raw, {
      kind: BUILDER_RESULT_KIND,
      schema: 'fundi.framed_full/1',
      caseId: 'framed-analysis',
      engine: 'Fundi framed analysis',
    });

    expect(stamped.analyses[BUILDER_RESULT_KIND].schema).toBe('fundi.framed_full/1');
    expect(stamped.analyses[BUILDER_RESULT_KIND].modelRevision).toBe(stamped.revision.index);
    // The OpenSees slot is untouched — the two pipelines do not overwrite each other.
    expect(stamped.analysis).toBeNull();
    expect(analysisStatus(stamped, BUILDER_RESULT_KIND).state).toBe('current');
    expect(analysisStatus(stamped).state).toBe('none');
  });

  test('a later structure change makes the builder results stale', () => {
    const first = builderToCanonicalModel({ elements: [column('C1', 0, 0)] }).model;
    const raw = [{ element_id: 'C1', N_max: 1200 }];
    const stamped = attachAnalysisDocument(first, raw, {
      kind: BUILDER_RESULT_KIND,
      schema: 'fundi.framed_full/1',
      caseId: 'framed-analysis',
    });

    // The edited structure is republished with a different section.
    const second = builderToCanonicalModel({
      elements: [column('C1', 0, 0, { width: 0.6, depth: 0.6 })],
    }).model;
    // Carry the earlier results onto the new model to prove they become stale.
    const carried = { ...second, analyses: stamped.analyses };
    expect(analysisStatus(carried, BUILDER_RESULT_KIND).state).toBe('stale');
    expect(analysisStatus(carried, BUILDER_RESULT_KIND).reason).toMatch(/changed after/);
  });

  test('a result document without a kind or case is refused', () => {
    const { model } = builderToCanonicalModel({ elements: [column('C1', 0, 0)] });
    expect(() => attachAnalysisDocument(model, [], { schema: 'x', caseId: 'c' })).toThrow(/kind/);
    expect(() =>
      attachAnalysisDocument(model, [], { kind: 'tall-frame', schema: 'x' })
    ).toThrow(/load case/);
  });
});
