/**
 * Framed & Tall Buildings builder → canonical engineering model.
 *
 * Why this module exists
 * ----------------------
 * The builder keeps its structure in its own `StructuralElement[]` state. That is
 * fine for editing, but it means its analysis results had no model revision to
 * belong to, so nothing could be marked stale when the structure changed. This
 * adapter publishes the builder's structure into the canonical model and gives it
 * a stable fingerprint, which is what lets `recordAnalysisDocument` stamp the
 * results and lets the unified workspace display the same building.
 *
 * What is preserved, what is derived, what is not invented
 * -------------------------------------------------------
 * * Preserved verbatim: element ids, types, storey (`layer`), start/end or centre
 *   coordinates, and the builder's own declared properties (width, depth, height,
 *   thickness, material). The defaults in `StructuralElement` are the builder's,
 *   not this adapter's.
 * * Derived geometrically: section area and second moment from width × depth, and
 *   the member end nodes from the element axis. These are geometric properties,
 *   recorded as warnings on the model.
 * * **Not** invented: a Young's modulus. The builder records a grade (e.g. `C30`)
 *   but not E, so the published material carries `youngsModulusPa: null` and the
 *   model reports itself as not analysable by the 2D frame solver. The builder's
 *   own analysis results are attached separately as the `tall-frame` result kind.
 * * Supports and loads are **not** synthesised: the builder's analysis endpoint
 *   derives them server-side, and they are not in its element state.
 *
 * Pure module: no React, no I/O — the mapping is unit-tested directly.
 */

import {
  createEngineeringModel,
  createMember,
  createNode,
  fingerprintModel,
  stableHash,
  validateEngineeringModel,
} from '../../../state/engineeringModel/core';

export const BUILDER_MODEL_ID = 'tall-frame';
export const BUILDER_RESULT_KIND = 'tall-frame';
export const BUILDER_RESULT_SCHEMA = 'fundi.framed_full/1';
export const BUILDER_MODEL_SCHEMA = 'fundi.engineering.model/1';

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const positive = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Stable fingerprint of everything the builder's analysis depends on.
 *
 * Order-independent (elements are sorted by id) and limited to inputs: ids,
 * types, storey, geometry and the section/material/load properties, plus the
 * analysis method. Selection, tool, view and camera are excluded, so merely
 * clicking around does not invalidate results.
 */
export function buildBuilderFingerprint({
  elements = [],
  method = 'moment_distribution',
  slabLoad = null,
} = {}) {
  const inputs = [...elements]
    .map((element) => ({
      id: element.id,
      type: element.type,
      layer: element.layer || null,
      position: element.position
        ? {
            x: element.position.x ?? null,
            y: element.position.y ?? null,
            z: element.position.z ?? null,
            start: element.position.start || null,
            end: element.position.end || null,
          }
        : null,
      properties: {
        width: element.properties?.width ?? null,
        depth: element.properties?.depth ?? null,
        height: element.properties?.height ?? null,
        thickness: element.properties?.thickness ?? null,
        material: element.properties?.material ?? null,
        load: element.properties?.load ?? null,
      },
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return stableHash(JSON.stringify({ inputs, method, slabLoad }));
}

/** Unique section per (width, depth) pair, with geometric properties. */
function sectionFor(registry, width, depth, warnings, elementId) {
  const id = `sec-${Number(width).toFixed(3)}x${Number(depth).toFixed(3)}`;
  if (!registry.has(id)) {
    const area = width * depth;
    const inertia = (width * Math.pow(depth, 3)) / 12;
    registry.set(id, {
      id,
      name: `${Math.round(width * 1000)}×${Math.round(depth * 1000)} mm`,
      width,
      depth,
      area,
      inertia,
      note:
        'A and Iz derived from the builder element width × depth as gross geometric ' +
        'properties; no design check is implied',
    });
    warnings.push(
      `${elementId}: section ${id} properties derived from width × depth (geometric only)`
    );
  }
  return id;
}

/** Material registry. E is deliberately absent — the builder does not state it. */
function materialFor(registry, grade, warnings, elementId) {
  const id = String(grade || 'unspecified');
  if (!registry.has(id)) {
    registry.set(id, {
      id,
      grade: id,
      youngsModulusPa: null,
      note:
        'the builder records a concrete grade, not a Young\'s modulus; E must be supplied ' +
        'explicitly before this model can be analysed by the frame solver',
    });
    warnings.push(`${elementId}: material ${id} has no explicit E (not inferred)`);
  }
  return id;
}

/**
 * Convert the builder's elements into a canonical engineering model.
 *
 * @param {object} input
 * @param {Array} input.elements       builder `StructuralElement[]`
 * @param {Array<string>} [input.layers] storey names, in order
 * @param {string} [input.modelId]
 * @param {string} [input.name]
 * @returns {{model: object, warnings: string[], skipped: Array<{id: string, reason: string}>}}
 */
export function builderToCanonicalModel({
  elements = [],
  layers = [],
  modelId = BUILDER_MODEL_ID,
  name = 'Framed & Tall building',
} = {}) {
  const nodes = [];
  const members = [];
  const sections = new Map();
  const materials = new Map();
  const generatorElements = [];
  const warnings = [];
  const skipped = [];

  const nodeAt = (key, x, y, z) => {
    const existing = nodes.find((node) => node.id === key);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.z = z;
      return existing;
    }
    const node = createNode({ id: key, x, y, z });
    nodes.push(node);
    return node;
  };

  for (const element of elements) {
    const id = element.id;
    const type = element.type;
    if (!id) {
      skipped.push({ id: '(no id)', reason: 'element has no id' });
      continue;
    }
    if (type === 'void') {
      // Openings are cut-outs, not structural solids; they get no geometry.
      skipped.push({ id, reason: 'void/opening is not a structural element' });
      continue;
    }

    const width = positive(element.properties?.width);
    const depth = positive(element.properties?.depth);
    const height = positive(element.properties?.height);
    const thickness = positive(element.properties?.thickness);
    const materialId = materialFor(materials, element.properties?.material, warnings, id);
    const storeyId = element.layer || null;

    if (type === 'column') {
      const x = num(element.position?.x);
      const y = num(element.position?.y);
      const z = num(element.position?.z);
      const h = height;
      if (!width || !depth || !h) {
        skipped.push({ id, reason: 'column needs positive width, depth and height' });
        continue;
      }
      const start = nodeAt(`${id}#start`, x, y, z);
      const end = nodeAt(`${id}#end`, x, y, z + h);
      const sectionId = sectionFor(sections, width, depth, warnings, id);
      members.push(
        createMember({
          id,
          type: 'column',
          startNodeId: start.id,
          endNodeId: end.id,
          sectionId,
          materialId,
          ifcClass: 'IfcColumn',
          name: `${id} column`,
          storeyId,
        })
      );
      generatorElements.push({
        id,
        name: `${id} column`,
        ifcClass: 'IfcColumn',
        axis: 'z',
        dimensions: { width_x: width, depth_y: depth, height_z: h },
        placement: { x, y, z: z + h / 2 },
        rotationZdeg: 0,
        material: element.properties?.material || null,
        levelId: storeyId,
        warnings: [],
      });
      continue;
    }

    if (type === 'beam' || type === 'wall') {
      const startPoint = element.position?.start || element.position || {};
      const endPoint = element.position?.end || element.position || {};
      const z = num(startPoint.z ?? endPoint.z);
      const x0 = num(startPoint.x);
      const y0 = num(startPoint.y);
      const x1 = num(endPoint.x);
      const y1 = num(endPoint.y);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.hypot(dx, dy);

      if (!(length > 0)) {
        skipped.push({ id, reason: `${type} has zero length` });
        continue;
      }

      // Wall thickness comes from `thickness`; beams use width × depth.
      const crossWidth = type === 'wall' ? thickness : width;
      const crossDepth = type === 'wall' ? height || depth : depth;
      if (!crossWidth || !crossDepth) {
        skipped.push({
          id,
          reason:
            type === 'wall'
              ? 'wall needs positive thickness and height'
              : 'beam needs positive width and depth',
        });
        continue;
      }

      const start = nodeAt(`${id}#start`, x0, y0, z);
      const end = nodeAt(`${id}#end`, x1, y1, z);
      const sectionId = sectionFor(sections, crossWidth, crossDepth, warnings, id);
      members.push(
        createMember({
          id,
          type,
          startNodeId: start.id,
          endNodeId: end.id,
          sectionId,
          materialId,
          ifcClass: type === 'wall' ? 'IfcWall' : 'IfcBeam',
          name: `${id} ${type}`,
          storeyId,
        })
      );

      // The wall's vertical extent is `height`; a beam's is its depth.
      const verticalExtent = type === 'wall' ? height : crossDepth;
      const alongX = Math.abs(dx) >= Math.abs(dy);
      const dimensions = alongX
        ? { length_x: length, width_y: crossWidth, height_z: verticalExtent }
        : { width_x: crossWidth, length_y: length, height_z: verticalExtent };
      generatorElements.push({
        id,
        name: `${id} ${type}`,
        ifcClass: type === 'wall' ? 'IfcWall' : 'IfcBeam',
        axis: alongX ? 'x' : 'y',
        dimensions,
        placement: {
          x: (x0 + x1) / 2,
          y: (y0 + y1) / 2,
          z: type === 'wall' ? z + verticalExtent / 2 : z,
        },
        rotationZdeg: 0,
        material: element.properties?.material || null,
        levelId: storeyId,
        warnings: [],
      });
      continue;
    }

    if (type === 'slab') {
      const w = width;
      const d = depth;
      const t = thickness;
      if (!w || !d || !t) {
        skipped.push({ id, reason: 'slab needs positive width, depth and thickness' });
        continue;
      }
      const x = num(element.position?.x);
      const y = num(element.position?.y);
      const z = num(element.position?.z);
      nodeAt(`${id}#origin`, x, y, z);
      generatorElements.push({
        id,
        name: `${id} slab`,
        ifcClass: 'IfcSlab',
        axis: 'z',
        dimensions: { length_x: w, width_y: d, thickness_z: t },
        placement: { x, y, z },
        rotationZdeg: 0,
        material: element.properties?.material || null,
        levelId: storeyId,
        warnings: [],
      });
      continue;
    }

    skipped.push({ id, reason: `unsupported element type ${JSON.stringify(type)}` });
  }

  const storeys = (layers.length ? layers : [...new Set(members.map((m) => m.storeyId).filter(Boolean))])
    .map((layer, index) => ({
      id: layer,
      name: layer,
      // The builder does not carry storey elevations; they are reported as unknown.
      elevation: null,
      elevationKnown: false,
      order: index,
    }));

  const model = createEngineeringModel({
    modelId,
    name,
    generator: 'framed_and_tall_builder',
    storeys,
    nodes,
    members,
    sections: [...sections.values()],
    materials: [...materials.values()],
    supports: [],
    loads: [],
    combinations: [],
    analysisCases: [{ id: 'framed-analysis', kind: 'static', source: 'tall-frame' }],
  });
  model.generatorElements = generatorElements;
  model.publishWarnings = [...warnings, ...skipped.map((entry) => `${entry.id}: ${entry.reason}`)];

  // The generator element records were attached after construction, and they are
  // part of the analysis fingerprint (they are the geometry the solver adapter
  // reads), so both the fingerprint and validation must be recomputed here.
  model.revision.fingerprint = fingerprintModel(model);
  model.revision.savedFingerprint = model.revision.fingerprint;
  model.validation = validateEngineeringModel(model);

  return { model, warnings: model.publishWarnings, skipped };
}

/** Storey elevations are unknown to the builder; state it rather than fake 0. */
export function unknownStoreyElevations(model) {
  return (model?.storeys || []).filter((storey) => storey.elevationKnown === false);
}

export default builderToCanonicalModel;
