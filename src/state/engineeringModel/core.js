/**
 * Fundi Studio — canonical engineering model (frontend core).
 *
 * This is the single source of truth shared by every view of a building:
 *
 *   - the R3F structural scenes (Framed & Tall builder, /visualise)
 *   - the MLightCAD 2D sheet (DXF entity handles)
 *   - the That Open BIM viewport (IFC GlobalIds)
 *   - the analysis views (OpenSees results, diagrams, reactions)
 *
 * It is *not* a second model: `fromCanonicalDocument()` imports the backend's
 * `fundi.canonical/1` document (src/Backend/cad_ifc/canonical.py) verbatim into
 * this shape, and `toCanonicalDocument()` exports it back in the same schema. The
 * backend remains the authority for generator output; this module adds the parts
 * the browser owns — edits, selection, revision tracking, and the association of
 * analysis results with the revision that produced them.
 *
 * Invariants enforced here
 * ------------------------
 * 1. Every entity has a stable `id` that never changes when other entities are
 *    edited, regenerated, imported or exported.
 * 2. Units and coordinates are explicit: the model is metres, Z-up, right-handed,
 *    and `UNITS` states it. Conversions happen only in the adapters.
 * 3. A change bumps `revision.index` and changes `revision.fingerprint`. Any
 *    analysis results stored with an older fingerprint are STALE and must not be
 *    presented as current.
 * 4. Nothing is written into the model without `validateEngineeringModel()`
 *    returning no errors (see `applyEdit`).
 * 5. Identity mappings (IFC GlobalId, CAD entity handles) are preserved across
 *    edits; a mapping is only removed when its entity is deleted.
 *
 * Everything in this file is pure: no React, no I/O, no timers. That keeps the
 * engineering data flow testable without a browser.
 */

/** Schema version of the *frontend* document. */
export const MODEL_SCHEMA = 'fundi.engineering.model/1';

/** The backend document schema this module imports from and exports to. */
export const CANONICAL_SCHEMA = 'fundi.canonical/1';

/**
 * Explicit unit and coordinate contract. Every number that crosses a module
 * boundary is interpreted using these declarations — there are no hidden
 * conversions.
 */
export const UNITS = Object.freeze({
  length: 'm',
  force: 'N',
  moment: 'N*m',
  stress: 'Pa',
  area: 'm^2',
  inertia: 'm^4',
  angle: 'rad',
  mass: 'kg',
});

export const COORDINATE_SYSTEM = Object.freeze({
  handedness: 'right',
  up: 'Z',
  planAxes: 'X (east) / Y (north)',
  verticalAxis: 'Z',
  note:
    'Model coordinates are metres in a right-handed Z-up frame. 2D CAD sheets are ' +
    'millimetres in the DXF XY plane; the CAD adapter applies ×1000 and drops Z ' +
    'only for entities that live on a plan view.',
});

/** DXF files produced by the backend are millimetres (`$INSUNITS = 4`). */
export const DXF_UNITS = Object.freeze({ length: 'mm', perMetre: 1000 });

/** IFC files are exported in metres (IfcSIUnit LENGTHUNIT = METRE). */
export const IFC_UNITS = Object.freeze({ length: 'm', perMetre: 1 });

/* ------------------------------------------------------------------ helpers */

let idCounter = 0;

/** Deterministic-enough unique id for entities created in the browser. */
export function makeId(prefix = 'el') {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const clone = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  const out = {};
  for (const [key, entry] of Object.entries(value)) out[key] = clone(entry);
  return out;
};

/**
 * Stable 32-bit FNV-1a hash of a string. Used for the model fingerprint; it is
 * not a security hash, it only has to detect change reliably and cheaply.
 */
export function stableHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fingerprint every engineering input that an analysis depends on.
 *
 * Deliberately excluded: selection, visibility, camera, panel state — changing
 * those must not invalidate results. Deliberately included: geometry, section,
 * material, supports, loads, combinations and the model revision index.
 */
export function fingerprintModel(model) {
  if (!model) return null;
  const relevant = {
    schema: model.schema,
    modelId: model.modelId,
    storeys: model.storeys,
    grids: model.grids,
    nodes: model.nodes,
    members: model.members,
    sections: model.sections,
    materials: model.materials,
    supports: model.supports,
    loads: model.loads,
    combinations: model.combinations,
    analysisCases: model.analysisCases,
    // Generator geometry is an *input* to both the renderers and the solver (the
    // 2D adapter derives A and Iz from width/depth), so a dimension, placement or
    // rotation edit must invalidate results. Identity fields (GlobalId, handles,
    // names) are deliberately excluded: attaching them is not an engineering
    // change.
    elements: (model.generatorElements || []).map((element) => ({
      id: element.id,
      dimensions: element.dimensions || null,
      placement: element.placement || null,
      rotationZdeg: element.rotationZdeg ?? null,
      material: element.material || null,
    })),
  };
  return stableHash(JSON.stringify(relevant));
}

/* --------------------------------------------------------------- construction */

/**
 * A node is a structural point. `id` is the canonical member/node identity used
 * by the solver adapter (`canonicalId` in `fundi.analysis.results/1`).
 */
export function createNode({ id, x, y, z = 0, storeyId = null, support = null }) {
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
    throw new Error('createNode requires finite x, y, z coordinates (metres)');
  }
  return {
    id: id || makeId('node'),
    kind: 'node',
    x,
    y,
    z,
    storeyId,
    support: support ? { ...support } : null,
  };
}

/**
 * A member is a straight prismatic element between two nodes. `ifcGlobalId` and
 * `cadHandles` carry the identity mapping from the other representations.
 */
export function createMember({
  id,
  type = 'beam',
  startNodeId,
  endNodeId,
  sectionId = null,
  materialId = null,
  rotationDeg = 0,
  ifcGlobalId = null,
  ifcClass = null,
  cadHandles = [],
  name = null,
  storeyId = null,
}) {
  if (!startNodeId || !endNodeId) {
    throw new Error('createMember requires startNodeId and endNodeId');
  }
  if (startNodeId === endNodeId) {
    throw new Error(`member ${id || '(new)'} cannot connect a node to itself`);
  }
  return {
    id: id || makeId('member'),
    kind: 'member',
    type,
    startNodeId,
    endNodeId,
    sectionId,
    materialId,
    rotationDeg,
    ifcGlobalId,
    ifcClass,
    cadHandles: [...cadHandles],
    name,
    storeyId,
  };
}

/**
 * Create an empty model. `building`/`storeys`/`grids` mirror the backend
 * canonical document so import and export are lossless for those blocks.
 */
export function createEngineeringModel({
  modelId = 'model',
  name = 'Untitled model',
  generator = null,
  building = null,
  storeys = [],
  grids = [],
  nodes = [],
  members = [],
  sections = [],
  materials = [],
  supports = [],
  loads = [],
  combinations = [],
  analysisCases = [],
} = {}) {
  const model = {
    schema: MODEL_SCHEMA,
    canonicalSchema: CANONICAL_SCHEMA,
    modelId,
    name,
    generator,
    units: { ...UNITS },
    coordinates: { ...COORDINATE_SYSTEM },
    building: building || { id: 'building-1', name: name || 'Building 1' },
    storeys: clone(storeys),
    grids: clone(grids),
    nodes: clone(nodes),
    members: clone(members),
    sections: clone(sections),
    materials: clone(materials),
    supports: clone(supports),
    loads: clone(loads),
    combinations: clone(combinations),
    analysisCases: clone(analysisCases),
    revision: { index: 0, fingerprint: null, savedFingerprint: null, savedAt: null },
    analysis: null,
    // Result sets per pipeline kind (`opensees-2d`, `tall-frame`, ...). Each entry
    // carries the revision + fingerprint it was computed from.
    analyses: {},
    validation: { errors: [], warnings: [], checkedAt: null },
    identity: buildIdentityIndex({
      members: clone(members),
      elements: [],
    }),
    history: [],
  };
  model.revision.fingerprint = fingerprintModel(model);
  model.revision.savedFingerprint = model.revision.fingerprint;
  return model;
}

/* ------------------------------------------------------------------ identity */

/**
 * Index every cross-representation identifier so any view can resolve an
 * element from a GlobalId, a CAD handle, or a canonical id in O(1).
 *
 * `elements` may be raw backend elements (`element.id`, `element.ifc_guid`) or
 * members of this model (`member.id`, `member.ifcGlobalId`). Both are accepted
 * because the workbench shows generator output while the builder owns members.
 */
export function buildIdentityIndex({ members = [], elements = [] } = {}) {
  const byGlobalId = {};
  const byHandle = {};
  const byElementId = {};

  const register = (entity) => {
    const id = entity.id;
    if (!id) return;
    const globalId = entity.ifcGlobalId || entity.ifc_guid || entity.guid || null;
    byElementId[id] = {
      id,
      globalId,
      ifcClass: entity.ifcClass || entity.ifc_class || null,
      handles: [...(entity.cadHandles || entity.cad_handles || [])],
    };
    if (globalId) byGlobalId[globalId] = id;
    for (const handle of byElementId[id].handles) {
      byHandle[String(handle)] = id;
    }
  };

  members.forEach(register);
  elements.forEach(register);

  return { byGlobalId, byHandle, byElementId, entityCount: Object.keys(byElementId).length };
}

/** Resolve a canonical member id from any identifier a viewer may hand back. */
export function resolveElementId(model, identifier, kind = 'auto') {
  if (!model || !identifier) return null;
  const index = model.identity || buildIdentityIndex();
  const key = String(identifier);

  if (kind === 'ifc' || kind === 'auto') {
    if (index.byGlobalId[key]) return index.byGlobalId[key];
  }
  if (kind === 'cad' || kind === 'auto') {
    if (index.byHandle[key]) return index.byHandle[key];
  }
  if (index.byElementId[key]) return key;
  // A raw `node#n1` / `member#e0` key from the solver is already canonical.
  if (key.includes('#')) return key.split('#')[0];
  return null;
}

/* --------------------------------------------------------------- node access */

export function nodeById(model, id) {
  if (!model) return null;
  return model.nodes.find((node) => node.id === id) || null;
}

/** Member length in metres, or `null` when an end node is missing. */
export function memberLength(model, member) {
  const a = nodeById(model, member.startNodeId);
  const b = nodeById(model, member.endNodeId);
  if (!a || !b) return null;
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/* --------------------------------------------------------------- validation */

/**
 * Validate the model before accepting a change.
 *
 * Errors block acceptance. Warnings are shown to the user and stored on the
 * model (so a view can distinguish "invalid" from "valid with modelling
 * assumptions"). Nothing here repairs data silently.
 */
export function validateEngineeringModel(model) {
  const errors = [];
  const warnings = [];

  if (!model || typeof model !== 'object') {
    return { ok: false, errors: ['model is missing'], warnings };
  }
  if (!model.modelId) errors.push('model.modelId is required');
  if (!model.units || model.units.length !== 'm') {
    errors.push('model.units.length must be "m" (the canonical unit)');
  }
  if (!model.coordinates || model.coordinates.up !== 'Z') {
    errors.push('model.coordinates.up must be "Z" (canonical frame is Z-up)');
  }

  const nodeIds = new Set();
  for (const node of model.nodes || []) {
    if (!node.id) errors.push('a node has no id');
    else if (nodeIds.has(node.id)) errors.push(`duplicate node id ${node.id}`);
    nodeIds.add(node.id);
    if (![node.x, node.y, node.z].every(isFiniteNumber)) {
      errors.push(`node ${node.id} has a non-finite coordinate`);
    }
  }

  const sectionIds = new Set((model.sections || []).map((section) => section.id));
  const materialIds = new Set((model.materials || []).map((material) => material.id));
  const memberIds = new Set();

  for (const member of model.members || []) {
    if (!member.id) errors.push('a member has no id');
    else if (memberIds.has(member.id)) errors.push(`duplicate member id ${member.id}`);
    memberIds.add(member.id);

    if (!nodeIds.has(member.startNodeId)) {
      errors.push(`member ${member.id} starts at unknown node ${member.startNodeId}`);
    }
    if (!nodeIds.has(member.endNodeId)) {
      errors.push(`member ${member.id} ends at unknown node ${member.endNodeId}`);
    }
    const length = memberLength(model, member);
    if (length === null) {
      // already reported through the missing-node errors
    } else if (length <= 0) {
      errors.push(`member ${member.id} has zero length`);
    } else if (length < 0.05) {
      warnings.push(`member ${member.id} is only ${(length * 1000).toFixed(0)} mm long`);
    }

    if (member.sectionId && !sectionIds.has(member.sectionId)) {
      errors.push(`member ${member.id} references unknown section ${member.sectionId}`);
    }
    if (!member.sectionId) {
      // Common while a structure is being drawn: geometrically valid, but not
      // analysable. Keep it as a *blocking* analysis prerequisite, not a model error.
      warnings.push(`member ${member.id} has no section assigned`);
    }
    if (member.materialId && !materialIds.has(member.materialId)) {
      errors.push(`member ${member.id} references unknown material ${member.materialId}`);
    }
    if (member.rotationDeg && !isFiniteNumber(member.rotationDeg)) {
      errors.push(`member ${member.id} has a non-finite rotation`);
    }
  }

  for (const section of model.sections || []) {
    if (!section.id) errors.push('a section has no id');
    if (!section.area || !isFiniteNumber(section.area) || section.area <= 0) {
      warnings.push(`section ${section.id} has no positive area; analysis will reject it`);
    }
    if (!section.inertia || !isFiniteNumber(section.inertia) || section.inertia <= 0) {
      warnings.push(`section ${section.id} has no positive inertia; analysis will reject it`);
    }
  }

  for (const material of model.materials || []) {
    if (!material.id) errors.push('a material has no id');
    if (!isFiniteNumber(material.youngsModulusPa) || material.youngsModulusPa <= 0) {
      warnings.push(`material ${material.id} has no positive E; analysis will reject it`);
    }
  }

  const supportIds = new Set();
  for (const support of model.supports || []) {
    if (!nodeIds.has(support.nodeId)) {
      errors.push(`support on unknown node ${support.nodeId}`);
    }
    if (!['ux', 'uy', 'uz', 'rx', 'ry', 'rz'].every((key) => ['boolean', 'undefined'].includes(typeof support[key]))) {
      errors.push(`support on node ${support.nodeId} has non-boolean restraints`);
    }
    if (
      support.ux === false && support.uy === false && support.uz === false &&
      support.rx === false && support.ry === false && support.rz === false
    ) {
      errors.push(`support on node ${support.nodeId} restrains nothing`);
    }
    if (supportIds.has(support.nodeId)) {
      errors.push(`more than one support on node ${support.nodeId}`);
    }
    supportIds.add(support.nodeId);
  }

  for (const load of model.loads || []) {
    if (load.kind === 'nodal') {
      if (!nodeIds.has(load.nodeId)) errors.push(`nodal load on unknown node ${load.nodeId}`);
      for (const key of ['fx', 'fy', 'fz', 'mx', 'my', 'mz']) {
        if (load[key] !== undefined && !isFiniteNumber(load[key])) {
          errors.push(`nodal load on ${load.nodeId} has a non-finite ${key}`);
        }
      }
    } else if (load.kind === 'element') {
      if (!memberIds.has(load.memberId)) {
        errors.push(`element load on unknown member ${load.memberId}`);
      }
      for (const key of ['wx', 'wy', 'wz']) {
        if (load[key] !== undefined && !isFiniteNumber(load[key])) {
          errors.push(`element load on ${load.memberId} has a non-finite ${key}`);
        }
      }
    } else {
      errors.push(`load ${load.id || '(unnamed)'} has an unsupported kind ${load.kind}`);
    }
    if (load.caseId && !(model.analysisCases || []).some((c) => c.id === load.caseId)) {
      warnings.push(`load ${load.id || '(unnamed)'} references unknown case ${load.caseId}`);
    }
  }

  for (const combination of model.combinations || []) {
    if (!Array.isArray(combination.terms) || combination.terms.length === 0) {
      errors.push(`combination ${combination.id} has no terms`);
    }
  }

  for (const entity of Object.values((model.identity && model.identity.byElementId) || {})) {
    if (entity.ifcClass && !entity.globalId) {
      warnings.push(`element ${entity.id} claims ${entity.ifcClass} without a GlobalId`);
    }
  }

  // Generator element records carry the geometry the 3D viewport draws and the
  // values a user can edit, so an impossible size or a non-finite placement is
  // rejected here — before it reaches a renderer, an export or a solver.
  for (const element of model.generatorElements || []) {
    if (!element.id) {
      errors.push('a generator element has no id');
      continue;
    }
    if (element.dimensions) {
      for (const [key, value] of Object.entries(element.dimensions)) {
        if (!isFiniteNumber(value) || value <= 0) {
          errors.push(`element ${element.id} dimension ${key} must be a positive number (m)`);
        }
      }
    }
    if (element.placement) {
      for (const axis of ['x', 'y', 'z']) {
        if (!isFiniteNumber(Number(element.placement[axis]))) {
          errors.push(`element ${element.id} placement ${axis} must be a finite number (m)`);
        }
      }
    }
    if (element.rotationZdeg !== undefined && !isFiniteNumber(Number(element.rotationZdeg))) {
      errors.push(`element ${element.id} rotation must be a finite angle in degrees`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, checkedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------- editing */

/**
 * Analysis readiness: the subset of conditions an analysis actually needs.
 * Kept separate from model validity so the UI can say "the model is valid but
 * cannot be analysed yet".
 */
export function analysisReadiness(model) {
  const blockers = [];
  if (!model) return { ready: false, blockers: ['no model loaded'] };
  if (!Array.isArray(model.members) || model.members.length === 0) {
    blockers.push('the model has no members');
  }
  const nodeIds = new Set((model.nodes || []).map((node) => node.id));
  for (const member of model.members || []) {
    if (!nodeIds.has(member.startNodeId) || !nodeIds.has(member.endNodeId)) {
      blockers.push(`member ${member.id} has a missing end node`);
    }
    const section = (model.sections || []).find((s) => s.id === member.sectionId);
    if (!section) blockers.push(`member ${member.id} has no section`);
    else if (!(section.area > 0) || !(section.inertia > 0)) {
      blockers.push(`section ${section.id} needs positive area and inertia`);
    }
    const material = (model.materials || []).find((m) => m.id === member.materialId);
    if (!material) blockers.push(`member ${member.id} has no material`);
    else if (!(material.youngsModulusPa > 0)) {
      blockers.push(`material ${material.id} needs a positive E`);
    }
  }
  if (!(model.supports || []).length) blockers.push('the model has no supports');
  if (!(model.loads || []).length) blockers.push('the model has no loads');
  return { ready: blockers.length === 0, blockers: [...new Set(blockers)] };
}

/**
 * Apply an edit transactionally.
 *
 * The candidate model is validated first; on error the original model is
 * returned unchanged together with the validation report. This is the only
 * supported way to change engineering data, which is how identity mapping and
 * revision tracking stay consistent.
 *
 * @param {object} model
 * @param {(draft: object) => void} mutate  called with a deep clone of the model
 * @param {{reason?: string}} [options]
 */
export function applyEdit(model, mutate, options = {}) {
  const draft = clone(model);
  mutate(draft);

  // Identity mappings must survive edits (requirement: stable ids through
  // editing). The previous index is authoritative because it also holds the
  // GlobalIds and CAD handles attached after generation, which neither the
  // members nor the elements necessarily carry themselves. Members that were just
  // added are appended from their own identity fields.
  const previousEntities = Object.values((model.identity && model.identity.byElementId) || {});
  const entities = previousEntities.map((entity) => ({
    id: entity.id,
    ifc_guid: entity.globalId,
    ifc_class: entity.ifcClass,
    cad_handles: entity.handles,
  }));
  for (const member of draft.members || []) {
    if (entities.some((entity) => entity.id === member.id)) continue;
    entities.push({
      id: member.id,
      ifc_guid: member.ifcGlobalId,
      ifc_class: member.ifcClass,
      cad_handles: member.cadHandles,
    });
  }
  draft.identity = buildIdentityIndex({ members: [], elements: entities });

  const report = validateEngineeringModel(draft);
  draft.validation = report;
  if (!report.ok) {
    return { ok: false, model, report };
  }

  draft.revision = {
    index: (model.revision?.index ?? 0) + 1,
    fingerprint: null,
    savedFingerprint: model.revision?.savedFingerprint ?? null,
    savedAt: model.revision?.savedAt ?? null,
  };
  draft.revision.fingerprint = fingerprintModel(draft);
  draft.history = [
    ...(model.history || []),
    {
      index: draft.revision.index,
      reason: options.reason || 'edit',
      at: new Date().toISOString(),
      fingerprint: draft.revision.fingerprint,
    },
  ].slice(-50);

  return { ok: true, model: draft, report };
}

/** Mark the current revision as saved (clears the unsaved-changes flag). */
export function markSaved(model) {
  if (!model) return model;
  const draft = clone(model);
  draft.revision.savedFingerprint = draft.revision.fingerprint;
  draft.revision.savedAt = new Date().toISOString();
  return draft;
}

/**
 * Edit one element's declared geometry (dimensions / placement / rotation).
 *
 * This is the member-property edit path the workspace exposes. It is deliberately
 * narrow and explicit:
 *
 * - only the fields supplied are changed; everything else is preserved;
 * - the edited element keeps its canonical id, IFC GlobalId and CAD handles, so
 *   every view keeps pointing at the same element;
 * - for a linear element the derived member end nodes are moved with it, so the
 *   structure view, the analysis readiness check and the identity index stay
 *   consistent with the geometry;
 * - the change goes through `applyEdit`, so validation runs *before* the model is
 *   accepted (a negative dimension or non-finite placement is rejected and the
 *   model is returned unchanged);
 * - a new revision invalidates attached analysis results automatically.
 *
 * It does NOT regenerate the DXF or the IFC: those artefacts then describe an older
 * revision, which the workspace reports as an out-of-date artefact instead of
 * pretending the files were updated.
 *
 * @param {object} model
 * @param {string} elementId
 * @param {{dimensions?: object, placement?: object, rotationZdeg?: number}} patch
 */
export function editElementGeometry(model, elementId, patch = {}) {
  if (!model) {
    return { ok: false, report: { ok: false, errors: ['no model is open'], warnings: [] } };
  }
  const exists = (model.generatorElements || []).some((element) => element.id === elementId);
  if (!exists) {
    return {
      ok: false,
      report: {
        ok: false,
        errors: [`element ${elementId} is not part of this model`],
        warnings: [],
      },
    };
  }

  return applyEdit(
    model,
    (draft) => {
      const element = (draft.generatorElements || []).find((entry) => entry.id === elementId);
      if (patch.dimensions) {
        element.dimensions = { ...(element.dimensions || {}) };
        for (const [key, value] of Object.entries(patch.dimensions)) {
          element.dimensions[key] = value;
        }
      }
      if (patch.placement) {
        element.placement = { ...(element.placement || { x: 0, y: 0, z: 0 }) };
        for (const axis of ['x', 'y', 'z']) {
          if (patch.placement[axis] !== undefined) {
            element.placement[axis] = patch.placement[axis];
          }
        }
      }
      if (patch.rotationZdeg !== undefined) {
        element.rotationZdeg = patch.rotationZdeg;
      }

      // Move the derived member with the element so every view agrees.
      const member = (draft.members || []).find((entry) => entry.id === elementId);
      const geometry = LINEAR_ELEMENT_TYPES.includes(
        element.element_type || member?.type || ''
      )
        ? elementAxisGeometry(element)
        : null;
      if (member && geometry) {
        const start = (draft.nodes || []).find((node) => node.id === member.startNodeId);
        const end = (draft.nodes || []).find((node) => node.id === member.endNodeId);
        if (start && end) {
          Object.assign(start, geometry.start);
          Object.assign(end, geometry.end);
        }
      }
    },
    { reason: `geometry edit: ${elementId}` }
  );
}

/** True when the model has changes that are not part of the last saved revision. */
export function hasUnsavedChanges(model) {
  if (!model || !model.revision) return false;
  return model.revision.savedFingerprint !== model.revision.fingerprint;
}

/* ------------------------------------------------------------------ analysis */

/**
 * Store one analysis result document, stamped with the revision that produced it.
 *
 * Result sets are kept per *kind* (`model.analyses[kind]`) because the application
 * has more than one analysis pipeline and their documents are not interchangeable:
 *
 *   * `opensees-2d`  — `fundi.analysis.results/1` from `src/Backend/cad_ifc/analysis.py`
 *   * `tall-frame`   — the Framed & Tall builder's own `/api/framed_full` response
 *
 * Each kind carries its own schema id and fingerprint, so a stale set is detected
 * against the model revision regardless of which pipeline produced it. The
 * document is stored verbatim; nothing here rewrites solver output.
 *
 * `model.analysis` remains an alias for `opensees-2d` so existing consumers (and
 * the 3D result view) keep working.
 *
 * @param {object} model
 * @param {object} results   the result document, stored verbatim
 * @param {object} meta
 * @param {string} meta.kind     result-set kind (required)
 * @param {string} meta.schema   schema id of the document (required)
 * @param {string} [meta.caseId] case identifier; defaults to the first case
 */
export function attachAnalysisDocument(model, results, meta = {}) {
  if (!model) throw new Error('attachAnalysisDocument needs a model');
  if (!results || typeof results !== 'object') {
    throw new Error('attachAnalysisDocument needs the result document');
  }
  const kind = meta.kind;
  if (!kind || typeof kind !== 'string') {
    throw new Error('attachAnalysisDocument requires an explicit result-set kind');
  }
  const schema = meta.schema || results.schema;
  if (!schema || typeof schema !== 'string') {
    throw new Error(`result set ${kind} must declare its schema`);
  }
  const cases = Array.isArray(results.cases) ? results.cases : [];
  const caseId = meta.caseId ?? cases[0]?.case_id ?? null;
  if (!caseId) {
    throw new Error(`result set ${kind} declares no load case`);
  }

  const draft = clone(model);
  const entry = {
    kind,
    schema,
    results,
    caseId,
    engine: results.engine?.name ?? meta.engine ?? 'unknown',
    engineVersion: results.engine?.version ?? null,
    units: results.units || meta.units || {},
    signConvention: results.sign_convention || meta.signConvention || null,
    modelRevision: draft.revision.index,
    fingerprint: draft.revision.fingerprint,
    solvedAt: meta.solvedAt || new Date().toISOString(),
  };
  draft.analyses = { ...(draft.analyses || {}), [kind]: entry };
  if (kind === OPEN_SEES_2D_KIND) draft.analysis = entry;
  return draft;
}

/** Kind id of the OpenSees 2D frame results (the default, back-compatible slot). */
export const OPEN_SEES_2D_KIND = 'opensees-2d';

/**
 * Attach `fundi.analysis.results/1` results (OpenSees, 2D frame).
 *
 * Kept strict on purpose: a document without load cases is not a solver result and
 * must not be stored as one.
 */
export function attachAnalysisResults(model, results, meta = {}) {
  if (!results || !Array.isArray(results.cases) || results.cases.length === 0) {
    throw new Error('solver results contain no load cases');
  }
  return attachAnalysisDocument(model, results, {
    ...meta,
    kind: meta.kind || OPEN_SEES_2D_KIND,
    schema: meta.schema || results.schema || 'fundi.analysis.results/1',
  });
}

/** Retrieve one result set by kind (defaults to the OpenSees 2D set). */
export function getAnalysis(model, kind = OPEN_SEES_2D_KIND) {
  if (!model) return null;
  return (model.analyses && model.analyses[kind]) || (kind === OPEN_SEES_2D_KIND ? model.analysis : null);
}

/**
 * Is the stored result set current?
 *
 * Stale results are still *shown* (they were real when computed) but the UI must
 * label them as stale and must not present them as the current state.
 */
export function analysisStatus(model, kind = OPEN_SEES_2D_KIND) {
  const entry = getAnalysis(model, kind);
  if (!entry) {
    return { kind, state: 'none', reason: `no ${kind} analysis has been run` };
  }
  const current = fingerprintModel(model);
  if (entry.fingerprint !== current) {
    return {
      kind,
      state: 'stale',
      reason:
        'the model geometry, sections, materials, supports or loads changed after this ' +
        'analysis was run',
      resultsRevision: entry.modelRevision,
      currentRevision: model.revision?.index ?? null,
    };
  }
  return {
    kind,
    state: 'current',
    reason: 'results were computed from this exact model revision',
    resultsRevision: entry.modelRevision,
    currentRevision: model.revision?.index ?? null,
  };
}

/* ------------------------------------------------- import / export adapters */

/**
 * Axis-aligned extent of a canonical element (`dimensions` keys are
 * generator-specific, so a suffixed key wins over a generic one).
 * Returns `null` for an axis that cannot be resolved.
 */
export function elementExtent(element) {
  const dims = element?.dimensions || {};
  const size = { x: null, y: null, z: null };
  const generic = [];
  for (const [key, raw] of Object.entries(dims)) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    const match = /_(x|y|z)$/.exec(key);
    if (match) {
      const axis = match[1];
      if (size[axis] == null || key.startsWith('length') || key.startsWith('height')) {
        size[axis] = value;
      }
    } else {
      generic.push([key, value]);
    }
  }
  const preferred = {
    x: ['length', 'width', 'breadth'],
    y: ['width', 'breadth', 'depth'],
    z: ['height', 'depth', 'thickness'],
  };
  for (const axis of ['x', 'y', 'z']) {
    if (size[axis] != null) continue;
    for (const name of preferred[axis]) {
      const found = generic.find(([key]) => key === name);
      if (found) {
        size[axis] = found[1];
        break;
      }
    }
  }
  return size;
}

/**
 * Derive a member's start/end nodes from a canonical element.
 *
 * The canonical document gives `axis`, `dimensions` and a **centre** `placement`
 * (verified against the beam generator: a 6.7 m beam has placement.x = 0 and
 * spans ±3.35 m). No direction is assumed beyond the declared axis.
 *
 * @returns {{start: {x,y,z}, end: {x,y,z}, extent: object}|null}
 */
export function elementAxisGeometry(element) {
  const extent = elementExtent(element);
  const placement = element.placement || null;
  if (!placement || !extent) return null;
  const axis = String(element.axis || 'x').toLowerCase();
  const length = extent[axis];
  if (!Number.isFinite(length) || length <= 0) return null;
  const centre = {
    x: Number(placement.x) || 0,
    y: Number(placement.y) || 0,
    z: Number(placement.z) || 0,
  };
  const half = { x: 0, y: 0, z: 0 };
  half[axis] = length / 2;
  return {
    start: { x: centre.x - half.x, y: centre.y - half.y, z: centre.z - half.z },
    end: { x: centre.x + half.x, y: centre.y + half.y, z: centre.z + half.z },
    extent,
  };
}

/**
 * Element types that behave as a straight linear member and therefore get a
 * node-pair member in the model. Slabs, footings and stairs are solids: they keep
 * their generator element record (geometry + identity) but must not be turned into
 * a fake one-element "member", which would make an unanalysable model look
 * analysable.
 */
export const LINEAR_ELEMENT_TYPES = Object.freeze([
  'beam',
  'column',
  'wall',
  'retaining_wall',
]);

/**
 * Import a backend canonical document (`GET /api/cad-ifc/model/{id}`).
 *
 * The backend document is the generator's output; this adapter keeps its data
 * and derives nodes/members from the declared geometry (axis + dimensions +
 * placement) only for linear element types. It never invents sections, materials
 * or supports: missing engineering data stays missing and validation reports it.
 */
export function fromCanonicalDocument(document) {
  if (!document || typeof document !== 'object') {
    throw new Error('fromCanonicalDocument needs the backend canonical document');
  }
  const elements = Array.isArray(document.elements) ? document.elements : [];
  const modelId = document.model_id || document.modelId || 'model';

  const nodes = [];
  const members = [];
  const nodeIndex = new Map();

  const ensureNode = (key, x, y, z) => {
    if (nodeIndex.has(key)) return nodeIndex.get(key);
    const node = createNode({ id: key, x, y, z });
    nodeIndex.set(key, node);
    nodes.push(node);
    return node;
  };

  for (const element of elements) {
    const id = element.id;
    if (!id) continue;
    const type = element.element_type || element.type || 'member';
    const isLinear = LINEAR_ELEMENT_TYPES.includes(type);
    // Explicit endpoints win; otherwise derive them from the declared axis — but
    // only for linear elements.
    const derived = isLinear && !(element.start && element.end)
      ? elementAxisGeometry(element)
      : null;
    const start = element.start || derived?.start || null;
    const end = element.end || derived?.end || null;
    if (isLinear && start && end) {
      const startNode = ensureNode(
        `${id}#start`,
        Number(start.x) || 0,
        Number(start.y) || 0,
        Number(start.z) || 0
      );
      const endNode = ensureNode(
        `${id}#end`,
        Number(end.x) || 0,
        Number(end.y) || 0,
        Number(end.z) || 0
      );
      if (startNode.id !== endNode.id) {
        members.push(
          createMember({
            id,
            type,
            startNodeId: startNode.id,
            endNodeId: endNode.id,
            ifcGlobalId: element.ifc_guid || null,
            ifcClass: element.ifc_class || null,
            name: element.name || element.role || id,
            storeyId: element.level_id || null,
          })
        );
      }
    } else if (element.placement) {
      // Solids (slab, footing, stair, ...) still get a reference node so identity
      // and coordinates exist, without pretending they are members.
      ensureNode(
        `${id}#origin`,
        Number(element.placement.x) || 0,
        Number(element.placement.y) || 0,
        Number(element.placement.z) || 0
      );
    }
  }

  const model = createEngineeringModel({
    modelId,
    name: document.name || modelId,
    generator: document.generator || null,
    building: document.building || { id: 'building-1', name: document.name || modelId },
    storeys: (document.levels || document.storeys || []).map((level) => ({
      id: level.id || level.level_id,
      name: level.name || level.id,
      elevation: Number(level.elevation ?? level.elevation_m ?? 0),
    })),
    grids: document.grids || [],
    nodes,
    members,
    sections: document.sections || [],
    materials: document.materials || [],
    supports: document.supports || [],
    loads: document.loads || [],
    combinations: document.combinations || [],
    analysisCases: document.analysis_cases || [],
  });

  // Keep the generator's own element records for geometry, identity and
  // provenance display. `dimensions`/`placement` are carried verbatim because the
  // 3D adapter draws exactly what the generator declared.
  model.generatorElements = elements.map((element) => ({
    id: element.id,
    name: element.name || element.role || element.id,
    ifcClass: element.ifc_class || null,
    guid: element.ifc_guid || null,
    axis: element.axis || null,
    dimensions: element.dimensions || null,
    placement: element.placement || null,
    rotationZdeg: element.rotation_z_deg ?? 0,
    material: element.material || null,
    levelId: element.level_id || null,
    warnings: element.validation?.warnings || element.warnings || [],
    provenance: element.provenance || null,
    reinforcement: element.reinforcement || null,
  }));
  model.identity = buildIdentityIndex({
    members,
    elements: elements.map((element) => ({
      id: element.id,
      ifc_guid: element.ifc_guid,
      ifc_class: element.ifc_class,
      cad_handles: element.cad_handles || [],
    })),
  });
  model.revision.fingerprint = fingerprintModel(model);
  model.revision.savedFingerprint = model.revision.fingerprint;
  model.validation = validateEngineeringModel(model);
  return model;
}

/**
 * Export to the backend canonical schema. Round-tripping an unedited document
 * returns the engineering blocks unchanged (no re-derivation, no unit change).
 */
export function toCanonicalDocument(model) {
  if (!model) throw new Error('toCanonicalDocument needs a model');
  return {
    schema: CANONICAL_SCHEMA,
    model_id: model.modelId,
    name: model.name,
    generator: model.generator,
    units: { ...model.units },
    coordinates: { ...model.coordinates },
    building: model.building,
    levels: (model.storeys || []).map((storey) => ({
      id: storey.id,
      name: storey.name,
      elevation: storey.elevation,
    })),
    grids: model.grids,
    nodes: model.nodes,
    members: model.members,
    sections: model.sections,
    materials: model.materials,
    supports: model.supports,
    loads: model.loads,
    combinations: model.combinations,
    analysis_cases: model.analysisCases,
    elements: (model.generatorElements || []).map((element) => ({
      id: element.id,
      name: element.name,
      ifc_class: element.ifcClass,
      ifc_guid: element.guid,
      dimensions: element.dimensions,
      provenance: element.provenance,
    })),
  };
}

/* -------------------------------------------------- coordinate / unit bridges */

/** Model metres -> DXF millimetres (plan view). */
export const metresToMillimetres = (value) => value * DXF_UNITS.perMetre;

/** DXF millimetres -> model metres. */
export const millimetresToMetres = (value) => value / DXF_UNITS.perMetre;

/** Model metres -> IFC metres (identity, stated so the adapter is explicit). */
export const metresToIfc = (value) => value * IFC_UNITS.perMetre;

/**
 * Convert a canonical node to the solver's global coordinates. The solver and
 * the model share the same Z-up frame, so this is an assertion, not a transform:
 * it fails loudly if the frames ever diverge instead of silently rotating data.
 */
export function nodeToSolverCoordinates(model, node) {
  if (model.coordinates?.up !== 'Z') {
    throw new Error(
      `cannot map a ${model.coordinates?.up || 'unknown'}-up model to the Z-up solver frame`
    );
  }
  if (model.units?.length !== 'm') {
    throw new Error(
      `cannot map a model in ${model.units?.length || 'unknown'} units to the solver's metre frame`
    );
  }
  return { x: node.x, y: node.y, z: node.z };
}

const engineeringModelCore = {
  MODEL_SCHEMA,
  CANONICAL_SCHEMA,
  UNITS,
  COORDINATE_SYSTEM,
  DXF_UNITS,
  IFC_UNITS,
  LINEAR_ELEMENT_TYPES,
  makeId,
  stableHash,
  fingerprintModel,
  createNode,
  createMember,
  createEngineeringModel,
  elementExtent,
  elementAxisGeometry,
  buildIdentityIndex,
  resolveElementId,
  nodeById,
  memberLength,
  validateEngineeringModel,
  analysisReadiness,
  applyEdit,
  editElementGeometry,
  markSaved,
  hasUnsavedChanges,
  attachAnalysisResults,
  attachAnalysisDocument,
  getAnalysis,
  OPEN_SEES_2D_KIND,
  analysisStatus,
  fromCanonicalDocument,
  toCanonicalDocument,
  metresToMillimetres,
  millimetresToMetres,
  metresToIfc,
  nodeToSolverCoordinates,
};

export default engineeringModelCore;
