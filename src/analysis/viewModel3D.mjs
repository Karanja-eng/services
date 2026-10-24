/**
 * Analysis results -> 3D display geometry.
 *
 * This extends `viewModel.mjs` (which produces the 2D view model) with the
 * geometry a three-dimensional viewport needs: member polylines, deformed
 * polylines, per-member force diagrams offset perpendicular to the member, and
 * reaction vectors.
 *
 * Engineering honesty rules (the reason this module exists separately):
 *
 * 1. **Nothing is fabricated.** Every number comes from `fundi.analysis.results/1`.
 *    When the solver provided only end forces, the diagram is a straight line
 *    between them and the entry carries `interpolation: 'none'` plus the warning
 *    from the 2D adapter, so the view can label it.
 * 2. **Diagrams are display-only.** A moment diagram is drawn at a scale that
 *    fits the viewport; the stored values are untouched and the scale is exported
 *    so a legend can state it. The same applies to deformation.
 * 3. **Dimensions are declared.** The solver integration is 2D (X right, Y up in
 *    the analytical plane). The canonical model is Z-up, so the adapter states and
 *    applies the mapping `(x, y) -> (x, 0, y)`: the analytical vertical axis
 *    becomes the model's Z axis, and the out-of-plane direction becomes Y. Without
 *    this step a beam elevation would be drawn flat on the ground plane.
 * 4. **Units and signs travel with the data.** `units`, `signConvention`, the local
 *    member axes and the coordinate mapping are returned, never assumed by the
 *    renderer.
 */

import { ViewModelError, buildViewModel, colourFor } from './viewModel.mjs';

export const VIEW_MODEL_3D_SCHEMA = 'fundi.viewmodel.analysis3d/1';

/** Fraction of the model's diagonal used by the largest force diagram. */
const DIAGRAM_FIT_FRACTION = 0.18;

/**
 * The declared coordinate mapping between the solver frame and the canonical
 * engineering frame. Exported so a view can print it instead of guessing.
 */
export const ANALYTICAL_COORDINATE_MAPPING = Object.freeze({
  solver: 'X right, Y up in the analytical plane (Z out of plane)',
  canonical: 'X, Y, Z with Z up',
  mapping: '(sx, sy) -> (x = sx, y = 0, z = sy)',
  note:
    'The 2D solver treats the member axis as X and the vertical in-plane direction as Y. ' +
    'The canonical model is Z-up, so the analytical Y becomes model Z. This is a display ' +
    'frame mapping only; no result value is transformed.',
});

/** Analytical (x, y) -> canonical (x, 0, z). */
export const solverPointToCanonical = (point) => ({ x: point.x, y: 0, z: point.y });

/**
 * Build the 3D view model for one analysis case.
 *
 * @param {object} results `fundi.analysis.results/1`
 * @param {object} [options]
 * @param {string} [options.caseId]        load case to display (defaults to the first)
 * @param {number} [options.deformationScale] display scale for displacements
 * @param {number} [options.diagramScale]  explicit offset scale (units of force per metre)
 * @param {'moment'|'shear'|'axial'} [options.diagram] which diagram to draw
 */
export function buildViewModel3D(results, options = {}) {
  const dimensionality = results?.dimensionality ?? (results?.degreesOfFreedom === 6 ? 3 : 2);
  if (dimensionality === 3) {
    return buildThreeDimensionalViewModel(results, options);
  }
  return buildPlanarViewModel(results, options);
}

/**
 * Planar (2D) solver output -> 3D display geometry.
 *
 * The solver's analytical plane is X-right/Y-up; the canonical model is Z-up, so
 * `solverPointToCanonical` is applied to every point (declared in the result).
 */
function buildPlanarViewModel(results, options = {}) {
  const base = buildViewModel(results, {
    caseId: options.caseId,
    deformationScale: options.deformationScale,
    colourBy:
      options.diagram === 'shear' || options.diagram === 'axial' ? options.diagram : 'moment',
  });

  const nodes = new Map(base.nodes.map((node) => [node.id, node]));

  // ---- geometry span, in the analytical plane --------------------------------
  const xs = base.nodes.map((node) => node.position.x);
  const ys = base.nodes.map((node) => node.position.y);
  const spanX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const spanY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  const diagonal = Math.hypot(spanX, spanY) || Math.max(spanX, spanY) || 1;

  // ---- undeformed / deformed polylines --------------------------------------
  const undeformed = [];
  const deformed = [];
  for (const member of base.members) {
    if (!member.undeformed) continue;
    undeformed.push({
      memberId: member.id,
      points: member.undeformed.map(solverPointToCanonical),
      sectionId: member.sectionId,
      forces: member.forces,
    });
    deformed.push({
      memberId: member.id,
      points: (member.deformed || member.undeformed).map(solverPointToCanonical),
      forces: member.forces,
    });
  }

  // ---- force diagrams -------------------------------------------------------
  const component = ['moment', 'shear', 'axial'].includes(options.diagram)
    ? options.diagram
    : 'moment';

  const diagramEntries = base.diagrams[component] || [];
  const peak = Math.max(...diagramEntries.map((entry) => entry.maxAbs), 0);
  const offsetPerUnit =
    Number.isFinite(options.diagramScale) && options.diagramScale > 0
      ? options.diagramScale
      : peak > 0
        ? (DIAGRAM_FIT_FRACTION * diagonal) / peak
        : 0;

  const diagrams = diagramEntries.map((entry) => {
    const member = base.members.find((candidate) => candidate.id === entry.memberId);
    if (!member || !member.undeformed) {
      return {
        ...entry,
        component,
        geometry: null,
        omitted: 'the member has no resolved node coordinates',
      };
    }
    const [start, end] = member.undeformed;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    // Local +y of the member in the analytical plane: the direction a diagram is
    // offset along. In canonical space this is the vertical (Z) direction for a
    // horizontal member.
    const nx = -dy / length;
    const ny = dx / length;

    const solverGeometry = entry.points.map((point) => {
      const t = entry.length > 0 ? point.x / entry.length : 0;
      const baseX = start.x + dx * t;
      const baseY = start.y + dy * t;
      const offset = point.value * offsetPerUnit;
      return { x: baseX + nx * offset, y: baseY + ny * offset, value: point.value, t };
    });

    // Close the polygon back to the member axis so the diagram reads as an area.
    const solverPolygon = [
      { x: start.x, y: start.y, value: 0, t: 0 },
      ...solverGeometry,
      { x: end.x, y: end.y, value: 0, t: 1 },
    ];

    return {
      ...entry,
      component,
      // Canonical (Z-up) geometry, which is what the 3D viewport draws.
      geometry: solverGeometry.map(solverPointToCanonical),
      polygon: solverPolygon.map(solverPointToCanonical),
      baseLine: [solverPointToCanonical(start), solverPointToCanonical(end)],
      // The solver-plane geometry is kept so a 2D plot and the 3D view can never
      // disagree about the value at a point.
      analyticalGeometry: solverGeometry,
      offsetPerUnit,
      localAxes: {
        along: { x: dx / length, y: dy / length, z: 0 },
        normal: { x: nx, y: ny, z: 0 },
      },
      omitted: null,
    };
  });

  // ---- reactions ------------------------------------------------------------
  const largestReaction = Math.max(...base.reactions.map((entry) => entry.magnitude), 0);
  const reactionLength = 0.12 * diagonal;
  const reactions = base.reactions.map((entry) => {
    const displayScale = largestReaction > 0 ? reactionLength / largestReaction : 0;
    const length = entry.magnitude * displayScale;
    const direction = entry.direction;
    return {
      ...entry,
      origin: solverPointToCanonical(entry.position),
      tip: solverPointToCanonical({
        x: entry.position.x + direction.x * length,
        y: entry.position.y + direction.y * length,
      }),
      length,
      displayScale,
      label: `${(entry.magnitude / 1000).toFixed(1)} kN`,
    };
  });

  // ---- supports (drawn from declared restraints, never inferred) ------------
  const supports = (base.supports || []).map((support) => {
    const node = nodes.get(support.node);
    return {
      nodeId: support.node,
      restraints: {
        ux: Boolean(support.ux),
        uy: Boolean(support.uy),
        rz: Boolean(support.rz),
      },
      fixed: Boolean(support.ux && support.uy && support.rz),
      position: node ? solverPointToCanonical(node.position) : null,
    };
  });

  return {
    schema: VIEW_MODEL_3D_SCHEMA,
    caseId: base.caseId,
    cases: (results.cases || []).map((entry) => entry.case_id),
    dimensionality: base.dimensionality,
    coordinateMapping: ANALYTICAL_COORDINATE_MAPPING,
    formulation: base.analysisFormulation,
    units: base.units,
    signConvention: base.signConvention,
    deformation: base.deformation,
    undeformed,
    deformed,
    diagrams: Object.fromEntries(
      ['moment', 'shear', 'axial'].map((key) => [
        key,
        key === component
          ? diagrams
          : (base.diagrams[key] || []).map((entry) => ({ ...entry, component: key })),
      ])
    ),
    activeDiagram: component,
    diagramUnits: {
      moment: base.units?.moment || 'N*m',
      shear: base.units?.force || 'N',
      axial: base.units?.force || 'N',
    },
    diagramScale: {
      offsetPerUnit,
      displayOnly: true,
      note:
        'diagram offsets are for display only; the plotted value at each point is the ' +
        'solver value in the stated units',
      maxAbs: peak,
    },
    reactions,
    reactionDisplayScale: largestReaction > 0 ? reactionLength / largestReaction : 0,
    supports,
    colouring: base.colouring,
    warnings: base.warnings,
    legend: {
      caseId: base.caseId,
      unit: component === 'moment' ? base.units?.moment : base.units?.force,
      max: base.colouring.max,
      exaggeration: base.deformation.scale,
      note: base.deformation.note,
    },
  };
}

/**
 * 3D solver output -> 3D display geometry.
 *
 * The 3D result document is already expressed in the canonical global frame, so no
 * frame transform is applied (and the view model says so). Member force diagrams are
 * the only new geometry: each local force component is drawn offset along the local
 * axis it acts about, using the member's own local axes reported by the engine — the
 * viewer never derives them.
 *
 * Components exposed (only those the 3D engine actually returns):
 *   axial (N, local x), shear (Vy, local y), shearZ (Vz, local z),
 *   moment (Mz, offset along local y), momentY (My, offset along local z),
 *   torsion (T, offset along local z, drawn at a fixed fraction of the fit scale).
 */
const THREE_D_COMPONENTS = {
  axial: { keys: ['N_i', 'N_j'], offsetAxis: 'x', unit: 'force', label: 'axial force' },
  shear: { keys: ['Vy_i', 'Vy_j'], offsetAxis: 'y', unit: 'force', label: 'shear force (local y)' },
  shearZ: { keys: ['Vz_i', 'Vz_j'], offsetAxis: 'z', unit: 'force', label: 'shear force (local z)' },
  moment: { keys: ['Mz_i', 'Mz_j'], offsetAxis: 'y', unit: 'moment', label: 'bending moment (local z)' },
  momentY: { keys: ['My_i', 'My_j'], offsetAxis: 'z', unit: 'moment', label: 'bending moment (local y)' },
  torsion: { keys: ['T_i', 'T_j'], offsetAxis: 'z', unit: 'moment', label: 'torsion' },
};

function buildThreeDimensionalViewModel(results, options = {}) {
  const caseId = options.caseId ?? results?.cases?.[0]?.case_id;
  const loadCase = (results.cases || []).find((entry) => entry.case_id === caseId);
  if (!loadCase) {
    throw new ViewModelError(
      `load case ${JSON.stringify(caseId)} is not in the results; available: ` +
        (results.cases || []).map((entry) => entry.case_id).join(', ')
    );
  }
  const deformationScale = options.deformationScale ?? 1;
  if (!Number.isFinite(deformationScale) || deformationScale <= 0) {
    throw new ViewModelError(
      `deformationScale must be a positive number, got ${deformationScale}`
    );
  }

  const component = Object.keys(THREE_D_COMPONENTS).includes(options.diagram)
    ? options.diagram
    : 'moment';

  // ---- nodes: geometry + display displacement (never mutating the result) -----
  const displacementByKey = loadCase.displacements || {};
  const nodeDisplacement = (tag, canonicalId) =>
    displacementByKey[canonicalId] ?? displacementByKey[`node${tag}`] ?? null;

  const nodes = (results.nodes || []).map((node) => {
    const displacement = nodeDisplacement(node.tag, node.canonicalId);
    const ux = displacement?.ux ?? 0;
    const uy = displacement?.uy ?? 0;
    const uz = displacement?.uz ?? 0;
    return {
      id: node.canonicalId ?? `node${node.tag}`,
      tag: node.tag,
      position: { x: node.x, y: node.y, z: node.z },
      displacement: { ux, uy, uz, rx: displacement?.rx ?? 0, ry: displacement?.ry ?? 0, rz: displacement?.rz ?? 0 },
      display: {
        x: node.x + deformationScale * ux,
        y: node.y + deformationScale * uy,
        z: node.z + deformationScale * uz,
      },
    };
  });
  const nodeByKey = new Map();
  for (const node of nodes) {
    nodeByKey.set(node.id, node);
    nodeByKey.set(`node${node.tag}`, node);
  }

  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const zs = nodes.map((node) => node.position.z);
  const diagonal =
    Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs)) || 1;

  // ---- members ---------------------------------------------------------------
  const memberEntries = Object.entries(loadCase.members || {});
  const members = memberEntries.map(([id, member]) => {
    const iNode = nodeByKey.get(`node${member.i}`) ?? nodeByKey.get(member.i) ?? null;
    const jNode = nodeByKey.get(`node${member.j}`) ?? nodeByKey.get(member.j) ?? null;
    return {
      id,
      element: member.element,
      i: member.i,
      j: member.j,
      length: member.length,
      sectionId: member.section_id ?? null,
      localAxes: member.localAxes || null,
      forces: {
        N_i: member.N_i, N_j: member.N_j,
        Vy_i: member.Vy_i, Vy_j: member.Vy_j,
        Vz_i: member.Vz_i, Vz_j: member.Vz_j,
        T_i: member.T_i, T_j: member.T_j,
        My_i: member.My_i, My_j: member.My_j,
        Mz_i: member.Mz_i, Mz_j: member.Mz_j,
      },
      undeformed:
        iNode && jNode
          ? [
              { ...iNode.position },
              { ...jNode.position },
            ]
          : null,
      deformed:
        iNode && jNode
          ? [
              { ...iNode.display },
              { ...jNode.display },
            ]
          : null,
    };
  });

  const undeformed = members
    .filter((member) => member.undeformed)
    .map((member) => ({
      memberId: member.id,
      points: member.undeformed,
      sectionId: member.sectionId,
      forces: member.forces,
    }));
  const deformed = members
    .filter((member) => member.deformed)
    .map((member) => ({ memberId: member.id, points: member.deformed, forces: member.forces }));

  // ---- diagrams --------------------------------------------------------------
  const offsetPerUnitFor = (peak) => (peak > 0 ? (0.18 * diagonal) / peak : 0);
  const peaks = {};
  for (const [name, spec] of Object.entries(THREE_D_COMPONENTS)) {
    peaks[name] = Math.max(
      ...members.map((member) =>
        Math.max(...spec.keys.map((key) => Math.abs(Number(member.forces[key]) || 0)))
      ),
      0
    );
  }
  const diagrams = {};
  const warnings = [];
  for (const [name, spec] of Object.entries(THREE_D_COMPONENTS)) {
    const offsetScale = offsetPerUnitFor(peaks[name]);
    diagrams[name] = members.map((member) => {
      if (!member.undeformed || !member.deformed) {
        return {
          memberId: member.id,
          component: name,
          geometry: null,
          omitted: 'the member has no resolved node coordinates',
        };
      }
      const axes = member.localAxes;
      const axis = axes ? axes[spec.offsetAxis] : null;
      if (!axis) {
        warnings.push(`member ${member.id}: no local axes in the 3D result; diagram not drawn`);
        return {
          memberId: member.id,
          component: name,
          geometry: null,
          omitted: 'the engine did not report local axes for this member',
        };
      }
      const values = spec.keys.map((key) => Number(member.forces[key]));
      const start = member.deformed[0];
      const end = member.deformed[1];
      const geometry = [0, 1].map((index) => {
        const base = index === 0 ? start : end;
        const offset = values[index] * offsetScale;
        return {
          x: base.x + axis.x * offset,
          y: base.y + axis.y * offset,
          z: base.z + axis.z * offset,
          value: values[index],
          t: index,
        };
      });
      const polygon = [
        { ...start, value: 0, t: 0 },
        geometry[0],
        geometry[1],
        { ...end, value: 0, t: 1 },
      ];
      return {
        memberId: member.id,
        component: name,
        length: member.length,
        points: values.map((value, index) => ({ x: index === 0 ? 0 : member.length, value })),
        geometry,
        polygon,
        baseLine: [{ ...start }, { ...end }],
        localAxes: axes,
        offsetPerUnit: offsetScale,
        source: 'end-forces-only',
        interpolation: 'none',
        maxAbs: Math.max(...values.map((value) => Math.abs(value))),
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        warning:
          '3D results carry member end forces only, so the diagram is drawn between the ' +
          'two end values; interior extremes are not represented',
      };
    });
  }
  if (members.length && !warnings.some((entry) => entry.includes('local axes'))) {
    warnings.push(
      '3D diagrams are drawn between member end forces only (no interior sampling in the 3D path)'
    );
  }

  // ---- reactions -------------------------------------------------------------
  const reactionEntries = Object.entries(loadCase.reactions || {});
  const largestReaction = Math.max(
    ...reactionEntries.map(([, item]) => Math.hypot(item.Fx || 0, item.Fy || 0, item.Fz || 0)),
    0
  );
  const reactionLength = 0.15 * diagonal;
  const reactionScale = largestReaction > 0 ? reactionLength / largestReaction : 0;
  const reactions = reactionEntries.map(([key, item]) => {
    const node = nodeByKey.get(key) ?? nodeByKey.get(`node${item.node}`);
    const origin = node ? { ...node.position } : { x: 0, y: 0, z: 0 };
    const magnitude = Math.hypot(item.Fx || 0, item.Fy || 0, item.Fz || 0);
    const direction =
      magnitude > 0
        ? { x: item.Fx / magnitude, y: item.Fy / magnitude, z: item.Fz / magnitude }
        : { x: 0, y: 0, z: 0 };
    return {
      nodeId: node?.id ?? key,
      tag: item.node,
      position: origin,
      forces: { Fx: item.Fx, Fy: item.Fy, Fz: item.Fz, Mx: item.Mx, My: item.My, Mz: item.Mz },
      magnitude,
      direction,
      origin,
      tip: {
        x: origin.x + direction.x * magnitude * reactionScale,
        y: origin.y + direction.y * magnitude * reactionScale,
        z: origin.z + direction.z * magnitude * reactionScale,
      },
      displayScale: reactionScale,
      label: `${(magnitude / 1000).toFixed(1)} kN`,
    };
  });

  // ---- supports (declared restraints only) -----------------------------------
  const supports = (loadCase.supports || []).map((support) => {
    const node = nodeByKey.get(`node${support.node}`) ?? null;
    const restraints = {
      ux: Boolean(support.ux), uy: Boolean(support.uy), uz: Boolean(support.uz),
      rx: Boolean(support.rx), ry: Boolean(support.ry), rz: Boolean(support.rz),
    };
    return {
      nodeId: node?.id ?? `node${support.node}`,
      restraints,
      fixed: Object.values(restraints).every(Boolean),
      position: node ? { ...node.position } : null,
    };
  });

  const activePeak = peaks[component] || 0;
  const colouring = {
    key: component,
    unit: THREE_D_COMPONENTS[component].unit === 'moment' ? results.units?.moment : results.units?.force,
    max: activePeak,
    byMember: {},
    legend: {
      min: 0,
      max: activePeak,
      stops: [0, 0.5, 1].map((value) => ({ value, colour: colourFor(value) })),
    },
  };
  for (const member of members) {
    const value = Math.max(
      ...THREE_D_COMPONENTS[component].keys.map((key) => Math.abs(Number(member.forces[key]) || 0))
    );
    const normalised = activePeak > 0 ? value / activePeak : 0;
    colouring.byMember[member.id] = { value, normalised, colour: colourFor(normalised) };
  }

  return {
    schema: VIEW_MODEL_3D_SCHEMA,
    caseId: loadCase.case_id,
    cases: (results.cases || []).map((entry) => entry.case_id),
    dimensionality: 3,
    coordinateMapping: {
      solver: 'global X, Y, Z (right-handed)',
      canonical: 'global X, Y, Z with Z up',
      mapping: 'identity — the 3D result document is already in the canonical frame',
    },
    formulation: loadCase.analysis?.formulation ?? '3D linear elastic static',
    units: results.units,
    signConvention: results.sign_convention,
    deformation: {
      scale: deformationScale,
      exaggerated: deformationScale !== 1,
      note: 'display coordinates only; the stored displacements are unchanged',
    },
    undeformed,
    deformed,
    diagrams,
    activeDiagram: component,
    diagramUnits: {
      axial: results.units?.force || 'N',
      shear: results.units?.force || 'N',
      shearZ: results.units?.force || 'N',
      moment: results.units?.moment || 'N*m',
      momentY: results.units?.moment || 'N*m',
      torsion: results.units?.moment || 'N*m',
    },
    diagramScale: {
      offsetPerUnit: offsetPerUnitFor(activePeak),
      displayOnly: true,
      note:
        'diagram offsets are for display only; each plotted value is the solver value in the ' +
        'stated units at the member end it belongs to',
      maxAbs: activePeak,
    },
    reactions,
    reactionDisplayScale: reactionScale,
    supports,
    colouring,
    warnings,
    legend: {
      caseId: loadCase.case_id,
      unit:
        THREE_D_COMPONENTS[component].unit === 'moment'
          ? results.units?.moment
          : results.units?.force,
      max: activePeak,
      exaggeration: deformationScale,
      note: '3D frame results, member end forces only',
    },
  };
}

/**
 * The analysis result envelope a viewer may receive.
 *
 * `runAnalysis()` returns `{ ok, model_id, case_id, results, analytical_model }`.
 * Some callers store only the outer envelope; this unwraps either shape and
 * refuses anything that is not real solver output.
 */
export function unwrapAnalysisResults(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('no analysis payload was supplied');
  }
  const candidate = payload.results && payload.results.cases ? payload.results : payload;
  if (!Array.isArray(candidate.cases) || candidate.cases.length === 0) {
    throw new Error('the payload contains no solver load cases');
  }
  if (!candidate.units || !candidate.sign_convention) {
    throw new Error(
      'the payload has no declared units/sign convention; refusing to display it as solver output'
    );
  }
  return candidate;
}

export default buildViewModel3D;
