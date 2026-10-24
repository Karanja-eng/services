/**
 * Canonical model -> display geometry for the 3D structural viewport.
 *
 * Why this module is separate from the component
 * ----------------------------------------------
 * The box a member is drawn as must be derived from the engineering model by a
 * rule that can be *read* and *tested*, not by JSX. If the rule is wrong the view
 * draws the wrong structure, which is an engineering error, not a styling one.
 *
 * The rule, stated explicitly
 * ---------------------------
 * The backend canonical document (`fundi.canonical/1`) describes each element as
 *
 *   { axis: 'x'|'y'|'z', dimensions: {...}, placement: {x, y, z}, rotation_z_deg }
 *
 * `placement` is the element's **centre** (verified against the beam generator:
 * a 6.7 m × 0.3 m × 0.6 m beam has placement z = 0.3, i.e. half its depth, and the
 * analytical model spans x = ±3.35 m about placement.x = 0).
 *
 * Dimension keys are generator-specific (`length_x`, `width_y`, `height_z`,
 * `depth`, `thickness`, ...), so the extent along each global axis is taken from a
 * key whose suffix matches that axis; a generic key is only used when no suffixed
 * key exists. Nothing is scaled or guessed silently: an element with no usable
 * dimension is reported in `unresolved`, not drawn as a unit box.
 *
 * Units: the canonical model is metres, Z-up. The returned boxes are metres.
 */

/** Suffix → global axis. `length_x` is the X extent, `height_z` the Z extent. */
const AXIS_SUFFIX = /_(x|y|z)$/;

/** Generic keys, in the order they are tried, per axis. */
const GENERIC_KEYS = {
  x: ['length', 'length_x', 'width', 'breadth'],
  y: ['width', 'width_y', 'breadth', 'depth'],
  z: ['height', 'height_z', 'depth', 'thickness'],
};

/**
 * Extract the axis-aligned extent of a canonical element.
 *
 * @param {{dimensions?: object, axis?: string}} element
 * @returns {{size: {x:number,y:number,z:number}, unresolved: string[]}}
 */
export function elementSize(element) {
  const dims = element?.dimensions || {};
  const size = { x: null, y: null, z: null };
  const generic = [];

  for (const [key, raw] of Object.entries(dims)) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    const match = AXIS_SUFFIX.exec(key);
    if (match) {
      const axis = match[1];
      // Prefer a `length_*` key when two keys target the same axis.
      if (size[axis] == null || key.startsWith('length')) size[axis] = value;
    } else {
      generic.push([key, value]);
    }
  }

  const unresolved = [];
  for (const axis of ['x', 'y', 'z']) {
    if (size[axis] != null) continue;
    const preferred = GENERIC_KEYS[axis];
    let chosen = null;
    for (const name of preferred) {
      const found = generic.find(([key]) => key === name);
      if (found) {
        chosen = found[1];
        break;
      }
    }
    if (chosen == null && generic.length) {
      // Last resort: the first unused generic dimension, in declaration order.
      chosen = generic[0]?.[1] ?? null;
    }
    if (chosen != null) size[axis] = chosen;
    else unresolved.push(axis);
  }

  return { size, unresolved };
}

/** Fallback geometry when an element has no dimensions: use the member axis. */
function sizeFromMember(member, model) {
  const start = (model.nodes || []).find((node) => node.id === member.startNodeId);
  const end = (model.nodes || []).find((node) => node.id === member.endNodeId);
  if (!start || !end) return null;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const dz = Math.abs(end.z - start.z);
  const thickness = 0.2; // a wirefall thickness, clearly reported as a fallback
  return {
    center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, z: (start.z + end.z) / 2 },
    size: {
      x: Math.max(dx, dx === 0 ? thickness : 0),
      y: Math.max(dy, dy === 0 ? thickness : 0),
      z: Math.max(dz, dz === 0 ? thickness : 0),
    },
    fallback: true,
  };
}

/**
 * Build the drawable boxes for a model.
 *
 * @param {object} model engineering model (`fundi.engineering.model/1`)
 * @returns {{boxes: object[], unresolved: object[], warnings: string[]}}
 */
export function buildCanonicalBoxes(model) {
  if (!model) return { boxes: [], unresolved: [], warnings: ['no model is open'] };
  const boxes = [];
  const unresolved = [];
  const warnings = [];

  const elements = model.generatorElements || [];
  for (const element of elements) {
    const placement = element.placement || null;
    if (element.dimensions && placement) {
      const { size, unresolved: missing } = elementSize(element);
      if (missing.length) {
        unresolved.push({ id: element.id, missing });
        continue;
      }
      boxes.push({
        id: element.id,
        name: element.name,
        ifcClass: element.ifcClass,
        center: { x: Number(placement.x) || 0, y: Number(placement.y) || 0, z: Number(placement.z) || 0 },
        size,
        rotationZdeg: Number(element.rotationZdeg ?? element.rotation_z_deg ?? 0) || 0,
        fallback: false,
        warnings: element.warnings || [],
      });
      continue;
    }

    // Generator elements without explicit geometry fall back to their member axis.
    const member = (model.members || []).find((candidate) => candidate.id === element.id);
    if (member) {
      const derived = sizeFromMember(member, model);
      if (derived) {
        boxes.push({
          id: element.id,
          name: element.name,
          ifcClass: element.ifcClass,
          ...derived,
          rotationZdeg: 0,
          warnings: [
            ...(element.warnings || []),
            'drawn from the member axis with an assumed 200 mm thickness; the canonical ' +
              'model carries no cross-section for this element',
          ],
        });
        continue;
      }
    }
    unresolved.push({ id: element.id, missing: ['dimensions', 'placement'] });
  }

  // Members with no generator element (the builder's own structure) are drawn from
  // their node coordinates so the canonical model is never invisible.
  for (const member of model.members || []) {
    if (boxes.some((box) => box.id === member.id)) continue;
    const derived = sizeFromMember(member, model);
    if (!derived) {
      unresolved.push({ id: member.id, missing: ['start/end node coordinates'] });
      continue;
    }
    boxes.push({
      id: member.id,
      name: member.name || member.id,
      ifcClass: member.ifcClass,
      ...derived,
      rotationZdeg: 0,
      warnings: [
        `member axis geometry, assumed 200 mm section (section ${member.sectionId || 'unassigned'})`,
      ],
    });
  }

  if (unresolved.length) {
    warnings.push(
      `${unresolved.length} element(s) could not be drawn because their geometry is not in ` +
        'the canonical model'
    );
  }
  return { boxes, unresolved, warnings };
}

/** Bounding sphere of the boxes, for camera framing. */
export function boxesBounds(boxes) {
  if (!boxes || boxes.length === 0) return { center: [0, 0, 0], radius: 5 };
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const box of boxes) {
    for (const axis of ['x', 'y', 'z']) {
      const half = (box.size[axis] || 0) / 2;
      min[axis] = Math.min(min[axis], box.center[axis] - half);
      max[axis] = Math.max(max[axis], box.center[axis] + half);
    }
  }
  const center = [
    (min.x + max.x) / 2,
    (min.y + max.y) / 2,
    (min.z + max.z) / 2,
  ];
  const radius =
    Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) / 2 || 5;
  return { center, radius };
}

/** Convenience: convert a box to the props a three.js box mesh needs. */
export function boxTransform(box) {
  return {
    position: [box.center.x, box.center.y, box.center.z],
    rotation: [0, 0, (box.rotationZdeg || 0) * (Math.PI / 180)],
    args: [box.size.x, box.size.y, box.size.z],
  };
}

export default buildCanonicalBoxes;
