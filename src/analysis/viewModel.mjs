/**
 * Analysis results -> 2D and 3D view models.
 *
 * This is the adapter layer Task E asks for, kept deliberately free of React so that the
 * geometry it produces can be tested numerically without a browser.
 *
 * What it does NOT do
 * -------------------
 * - It never fabricates a diagram. If the analysis did not sample interior values for a
 *   member, the diagram carries end values only, with `interpolation` and a warning
 *   saying so. (The existing `SteelAnalysisAdapter.extractMemberForces` returns
 *   `maxMoment: 0, maxShear: 0` when a diagram is missing, which turns "unknown" into a
 *   zero force that a design check would accept; this module raises instead.)
 * - It never mutates the stored results: the deformation scale only affects the returned
 *   display coordinates.
 * - It does not claim 3D analysis. A 2D result is drawn in a 3D scene on the XY plane
 *   only, and the view model says `dimensionality: 2`.
 *
 * Units are whatever the results declare (`results.units`); nothing is converted here.
 */

const MEMBER_FORCE_KEYS = ['N_i', 'V_i', 'M_i', 'N_j', 'V_j', 'M_j'];

export class ViewModelError extends Error {}

/** Signed colour ramp (blue -> green -> red) for a normalised value in [0, 1]. */
export function colourFor(value) {
  const clamped = Math.min(1, Math.max(0, value));
  const stops = [
    [0.0, [49, 130, 246]],
    [0.5, [34, 197, 94]],
    [1.0, [239, 68, 68]],
  ];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [p0, c0] = stops[index];
    const [p1, c1] = stops[index + 1];
    if (clamped >= p0 && clamped <= p1) {
      const t = (clamped - p0) / (p1 - p0 || 1);
      const rgb = c0.map((channel, i) => Math.round(channel + t * (c1[i] - channel)));
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
  return 'rgb(49, 130, 246)';
}

function requireCase(results, caseId) {
  if (!results || !Array.isArray(results.cases) || results.cases.length === 0) {
    throw new ViewModelError('analysis results contain no cases; nothing to display');
  }
  const found = results.cases.find((entry) => entry.case_id === caseId);
  if (!found) {
    throw new ViewModelError(
      `load case ${JSON.stringify(caseId)} is not in the results; available: ` +
        results.cases.map((entry) => entry.case_id).join(', '),
    );
  }
  return found;
}

function memberEntries(loadCase) {
  const members = loadCase.members || {};
  const entries = Object.entries(members);
  if (entries.length === 0) {
    throw new ViewModelError('the selected case has no member results');
  }
  for (const [id, member] of entries) {
    for (const key of MEMBER_FORCE_KEYS) {
      const value = member[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ViewModelError(`member ${id} has a missing or non-finite ${key}`);
      }
    }
    if (typeof member.length !== 'number' || member.length <= 0) {
      throw new ViewModelError(`member ${id} has no usable length`);
    }
  }
  return entries;
}

/**
 * Build the 2D diagram for one member.
 *
 * Sampled points are used when the analysis provides them (`case.diagrams`). Otherwise the
 * shear and axial diagrams are built from their two end values with `interpolation:
 * 'linear'` (exact for a uniformly loaded or unloaded prismatic member), while the moment
 * diagram carries its two end values only and is flagged, because a moment diagram between
 * end values is only linear when there is no transverse load.
 */
function memberDiagram(loadCase, memberId, member, component) {
  const sampledRoot = Array.isArray(loadCase.diagrams) ? loadCase.diagrams : [];
  const sampled = sampledRoot.find(
    (entry) => entry.member_id === memberId || entry.memberId === memberId,
  );
  if (sampled && Array.isArray(sampled.points) && sampled.points.length >= 2) {
    const key = { shear: 'V', moment: 'M', axial: 'N' }[component];
    const points = sampled.points
      .map((point) => ({ x: Number(point.x), value: Number(point[key]) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.value));
    if (points.length >= 2) {
      return { points, source: 'sampled', interpolation: 'sampled' };
    }
  }

  if (component === 'moment') {
    // End values only. Do not interpolate: a linear moment diagram would understate (or
    // invent) an interior maximum.
    return {
      points: [
        { x: 0, value: member.M_i },
        { x: member.length, value: member.M_j },
      ],
      source: 'end-forces-only',
      interpolation: 'none',
      warning:
        `member ${memberId}: no sampled moment diagram, so only the two end moments are ` +
        'known; an interior maximum (e.g. sagging under a UDL) is not represented',
    };
  }

  const endKey = component === 'shear' ? ['V_i', 'V_j'] : ['N_i', 'N_j'];
  return {
    points: [
      { x: 0, value: member[endKey[0]] },
      { x: member.length, value: member[endKey[1]] },
    ],
    source: 'end-forces',
    interpolation: 'linear',
  };
}

/**
 * Build the view model for one analysis case.
 *
 * @param {object} results normalised results (`fundi.analysis.results/1`)
 * @param {{caseId?: string, deformationScale?: number, colourBy?: 'moment'|'shear'|'axial'}} options
 */
export function buildViewModel(results, options = {}) {
  const caseId = options.caseId ?? results?.cases?.[0]?.case_id;
  const loadCase = requireCase(results, caseId);
  const deformationScale = options.deformationScale ?? 1;
  if (!Number.isFinite(deformationScale) || deformationScale <= 0) {
    throw new ViewModelError(`deformationScale must be a positive number, got ${deformationScale}`);
  }
  const colourBy = options.colourBy ?? 'moment';
  if (!['moment', 'shear', 'axial'].includes(colourBy)) {
    throw new ViewModelError(`colourBy must be moment, shear or axial, got ${colourBy}`);
  }

  const entries = memberEntries(loadCase);

  // --- nodes: undeformed and display-deformed ---------------------------------
  // The stored displacement is preserved verbatim; `display` is derived from it and the
  // scale, so changing the scale can never change the engineering result.
  const nodes = Object.entries(loadCase.displacements || {}).map(([id, item]) => ({
    id,
    tag: item.node,
    position: { x: 0, y: 0 },
    displacement: { ux: item.ux, uy: item.uy, rz: item.rz },
    display: { x: 0, y: 0 },
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  // Coordinates come from the results' node list (canonical ids), because the displacements
  // block is keyed by canonical id while the geometry lives in `nodes`.
  for (const node of results.nodes || []) {
    const key = node.canonicalId ?? `node${node.tag}`;
    const target = nodeById.get(key);
    if (!target) continue;
    target.position = { x: node.x, y: node.y };
    target.display = {
      x: node.x + deformationScale * target.displacement.ux,
      y: node.y + deformationScale * target.displacement.uy,
    };
  }

  // Members: index from element tag to node ids so a polyline can be built.
  const displacementsByTag = new Map(nodes.map((node) => [node.tag, node]));
  const members = entries.map(([id, member]) => {
    const iNode = displacementsByTag.get(member.i);
    const jNode = displacementsByTag.get(member.j);
    return {
      id,
      element: member.element,
      i: member.i,
      j: member.j,
      length: member.length,
      sectionId: member.section_id ?? null,
      forces: Object.fromEntries(MEMBER_FORCE_KEYS.map((key) => [key, member[key]])),
      undeformed: iNode && jNode
        ? [{ x: iNode.position.x, y: iNode.position.y }, { x: jNode.position.x, y: jNode.position.y }]
        : null,
      deformed: iNode && jNode
        ? [{ x: iNode.display.x, y: iNode.display.y }, { x: jNode.display.x, y: jNode.display.y }]
        : null,
    };
  });

  // --- diagrams ---------------------------------------------------------------
  const warnings = [];
  const diagrams = { shear: [], moment: [], axial: [] };
  for (const component of ['shear', 'moment', 'axial']) {
    for (const [id, member] of entries) {
      const diagram = memberDiagram(loadCase, id, member, component);
      if (diagram.warning) warnings.push(diagram.warning);
      const values = diagram.points.map((point) => Math.abs(point.value));
      diagrams[component].push({
        memberId: id,
        length: member.length,
        points: diagram.points,
        source: diagram.source,
        interpolation: diagram.interpolation,
        maxAbs: Math.max(...values),
        minValue: Math.min(...diagram.points.map((point) => point.value)),
        maxValue: Math.max(...diagram.points.map((point) => point.value)),
      });
    }
  }

  // --- reactions --------------------------------------------------------------
  const reactions = Object.entries(loadCase.reactions || {}).map(([id, item]) => {
    const node = nodeById.get(id) || nodes.find((entry) => entry.tag === item.node);
    const magnitude = Math.hypot(item.Fx, item.Fy);
    return {
      nodeId: node?.id ?? id,
      tag: item.node,
      position: node ? { ...node.position } : { x: 0, y: 0 },
      forces: { Fx: item.Fx, Fy: item.Fy, Mz: item.Mz },
      magnitude,
      // Display geometry only: a unit direction, not a scaled force.
      direction: magnitude > 0
        ? { x: item.Fx / magnitude, y: item.Fy / magnitude }
        : { x: 0, y: 0 },
    };
  });

  // --- colour mapping ---------------------------------------------------------
  const colourSource = diagrams[colourBy];
  const overallMax = Math.max(...colourSource.map((entry) => entry.maxAbs), 0);
  const colourByMember = {};
  for (const entry of colourSource) {
    const normalised = overallMax > 0 ? entry.maxAbs / overallMax : 0;
    colourByMember[entry.memberId] = { value: entry.maxAbs, normalised, colour: colourFor(normalised) };
  }

  return {
    schema: 'fundi.viewmodel.analysis/1',
    caseId,
    dimensionality: 2,
    analysisFormulation: loadCase.analysis?.formulation ?? 'not stated by the analysis',
    units: results.units,
    signConvention: results.sign_convention,
    deformation: {
      scale: deformationScale,
      // Stated so the UI can label an exaggerated shape honestly.
      exaggerated: deformationScale !== 1,
      note: 'display coordinates only; the stored displacements are unchanged',
    },
    nodes,
    members,
    // Support restraints exactly as supplied to the analysis (never inferred), so a view
    // can draw pin/roller/fixed symbols without guessing from reactions.
    supports: loadCase.supports ?? [],
    diagrams,
    reactions,
    colouring: {
      key: colourBy,
      unit: colourBy === 'moment' ? results.units?.moment : results.units?.force,
      max: overallMax,
      byMember: colourByMember,
      legend: { min: 0, max: overallMax, stops: [0, 0.5, 1].map((value) => ({ value, colour: colourFor(value) })) },
    },
    warnings,
  };
}

export default buildViewModel;
