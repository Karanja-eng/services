/**
 * Unit tests for canonical-model -> 3D display geometry.
 *
 * The rule under test is the one that decides whether the 3D viewport draws the
 * right structure: `placement` is a centre, extents come from axis-suffixed
 * dimension keys, and anything unbuildable is reported instead of guessed.
 */

import { boxesBounds, boxTransform, buildCanonicalBoxes, elementSize } from '../modelGeometry';

const beamDocumentModel = {
  modelId: 'beam',
  nodes: [
    { id: 'beam.beam#start', x: -3.35, y: 0, z: 0.3 },
    { id: 'beam.beam#end', x: 3.35, y: 0, z: 0.3 },
  ],
  members: [
    {
      id: 'beam.beam',
      startNodeId: 'beam.beam#start',
      endNodeId: 'beam.beam#end',
      sectionId: null,
    },
  ],
  generatorElements: [
    {
      id: 'beam.beam',
      name: 'Suspended beam',
      ifcClass: 'IfcBeam',
      dimensions: { length_x: 6.7, width_y: 0.3, height_z: 0.6 },
      placement: { x: 0, y: 0, z: 0.3 },
      rotationZdeg: 0,
      warnings: [],
    },
  ],
};

describe('elementSize', () => {
  test('reads extents from axis-suffixed keys', () => {
    expect(elementSize(beamDocumentModel.generatorElements[0])).toEqual({
      size: { x: 6.7, y: 0.3, z: 0.6 },
      unresolved: [],
    });
  });

  test('falls back to generic keys only when no suffixed key exists', () => {
    expect(elementSize({ dimensions: { length: 4, width: 0.3, height: 0.5 } }).size).toEqual({
      x: 4,
      y: 0.3,
      z: 0.5,
    });
  });

  test('reports an unresolvable axis instead of inventing a size', () => {
    const result = elementSize({ dimensions: { length_x: 4 } });
    expect(result.size.x).toBe(4);
    expect(result.unresolved).toContain('z');
  });

  test('ignores non-positive and non-numeric dimensions', () => {
    const result = elementSize({
      dimensions: { length_x: 0, width_y: 'n/a', height_z: 0.6 },
    });
    expect(result.size.z).toBe(0.6);
    expect(result.size.x).toBeNull();
  });
});

describe('buildCanonicalBoxes', () => {
  test('builds one box per generated element, centred on placement', () => {
    const { boxes, unresolved } = buildCanonicalBoxes(beamDocumentModel);
    expect(unresolved).toHaveLength(0);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].center).toEqual({ x: 0, y: 0, z: 0.3 });
    expect(boxes[0].size).toEqual({ x: 6.7, y: 0.3, z: 0.6 });
    expect(boxes[0].fallback).toBe(false);
  });

  test('falls back to the member axis, with a warning, when dimensions are missing', () => {
    const model = {
      ...beamDocumentModel,
      generatorElements: [{ id: 'beam.beam', name: 'beam', ifcClass: 'IfcBeam' }],
    };
    const { boxes } = buildCanonicalBoxes(model);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].fallback).toBe(true);
    expect(boxes[0].size.x).toBeCloseTo(6.7);
    expect(boxes[0].warnings.join(' ')).toMatch(/assumed 200 mm/);
  });

  test('reports an element whose geometry and member axis are both unusable', () => {
    const model = {
      modelId: 'x',
      nodes: [],
      members: [],
      generatorElements: [{ id: 'ghost', name: 'ghost' }],
    };
    const { boxes, unresolved } = buildCanonicalBoxes(model);
    expect(boxes).toHaveLength(0);
    expect(unresolved[0].id).toBe('ghost');
  });

  test('an empty model is handled without throwing', () => {
    const { boxes, warnings } = buildCanonicalBoxes(null);
    expect(boxes).toHaveLength(0);
    expect(warnings[0]).toMatch(/no model/);
  });
});

describe('bounds and transforms', () => {
  test('bounds surround the members', () => {
    const { boxes } = buildCanonicalBoxes(beamDocumentModel);
    const bounds = boxesBounds(boxes);
    expect(bounds.center[0]).toBeCloseTo(0);
    expect(bounds.center[2]).toBeCloseTo(0.3);
    expect(bounds.radius).toBeGreaterThan(3);
  });

  test('empty bounds stay usable for the camera', () => {
    const bounds = boxesBounds([]);
    expect(bounds.center).toEqual([0, 0, 0]);
    expect(bounds.radius).toBeGreaterThan(0);
  });

  test('rotation is converted from degrees to radians', () => {
    const transform = boxTransform({ center: { x: 1, y: 2, z: 3 }, size: { x: 1, y: 1, z: 1 }, rotationZdeg: 90 });
    expect(transform.position).toEqual([1, 2, 3]);
    expect(transform.rotation[2]).toBeCloseTo(Math.PI / 2);
    expect(transform.args).toEqual([1, 1, 1]);
  });
});
