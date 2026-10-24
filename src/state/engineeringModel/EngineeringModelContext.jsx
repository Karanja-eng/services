/**
 * Fundi Studio — engineering model provider.
 *
 * One React context owns the canonical model for the whole application session,
 * so every view (R3F, MLightCAD, That Open, analysis) resolves the *same*
 * element ids and shows the *same* accepted revision.
 *
 * Design rules
 * ------------
 * - The provider is the only writer. Views receive `model`, `selection` and the
 *   action functions; they never mutate model objects.
 * - Selection is shared, but it is not part of the engineering data: changing it
 *   does not bump the revision and cannot invalidate analysis results.
 * - Unsaved edits survive view switching *and* route changes: the accepted model
 *   and its dirty flag are persisted to `sessionStorage`, so navigating to
 *   `/visualise` and back does not silently discard work.
 * - Loading a different model never merges two models. Conflicts are reported,
 *   not reconciled silently.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  analysisReadiness,
  analysisStatus,
  applyEdit as applyEditToModel,
  attachAnalysisDocument,
  attachAnalysisResults,
  buildIdentityIndex,
  editElementGeometry,
  createEngineeringModel,
  fingerprintModel,
  fromCanonicalDocument,
  hasUnsavedChanges,
  markSaved,
  resolveElementId,
  validateEngineeringModel,
} from './core';

const STORAGE_KEY = 'fundi.engineeringModel.session.v1';

const EngineeringModelContext = createContext(null);

function readPersisted() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema !== 'fundi.engineering.model/1') return null;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.members)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(model) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (!model) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // A full quota must not break editing; the in-memory model stays authoritative.
  }
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {object} [props.initialModel] model to open on first mount
 * @param {boolean} [props.persist=true] keep the session model across routes
 */
export function EngineeringModelProvider({
  children,
  initialModel = null,
  persist: shouldPersist = true,
}) {
  const [model, setModel] = useState(() => initialModel || readPersisted() || null);
  const [selection, setSelection] = useState({ ids: [], primary: null, source: null });
  const [conflict, setConflict] = useState(null);
  const [report, setReport] = useState(null);

  // Mirror of the model for actions that must compute synchronously.
  const modelRef = useRef(model);
  modelRef.current = model;
  const persistedRef = useRef(null);

  // Persist only when the engineering data actually changed.
  useEffect(() => {
    if (!shouldPersist) return;
    const fingerprint = model
      ? `${model.modelId}:${model.revision?.fingerprint}:${model.revision?.index}`
      : null;
    if (fingerprint === persistedRef.current) return;
    persistedRef.current = fingerprint;
    persist(model);
  }, [model, shouldPersist]);

  const pruneSelection = useCallback((nextModel) => {
    setSelection((current) => {
      if (!current.primary) return current;
      const exists =
        nextModel.nodes.some((node) => node.id === current.primary) ||
        nextModel.members.some((member) => member.id === current.primary);
      if (exists) return current;
      return { ids: [], primary: null, source: current.source };
    });
  }, []);

  /** Open a model produced by the backend canonical document. */
  const loadFromCanonicalDocument = useCallback(
    (document, options = {}) => {
      const next = fromCanonicalDocument(document);
      const previous = modelRef.current;
      if (
        previous &&
        previous.modelId !== next.modelId &&
        hasUnsavedChanges(previous) &&
        !options.discardUnsaved
      ) {
        // Never silently discard unsaved engineering work.
        setConflict({
          kind: 'unsaved-changes',
          message:
            `The open model "${previous.modelId}" has unsaved changes. Loading ` +
            `"${next.modelId}" would discard them.`,
          pendingModelId: next.modelId,
        });
        return { opened: false, model: previous };
      }
      modelRef.current = next;
      setModel(next);
      setSelection({ ids: [], primary: null, source: null });
      setConflict(null);
      setReport(next.validation || null);
      return { opened: true, model: next };
    },
    []
  );

  /** Replace the model wholesale (e.g. a saved model restored from disk). */
  const loadModel = useCallback((next, options = {}) => {
    if (!next) return { opened: false };
    const previous = modelRef.current;
    if (previous && hasUnsavedChanges(previous) && !options.discardUnsaved) {
      setConflict({
        kind: 'unsaved-changes',
        message: `Reloading "${next.modelId}" would discard unsaved changes.`,
        pendingModelId: next.modelId,
      });
      return { opened: false, model: previous };
    }
    modelRef.current = next;
    setModel(next);
    setSelection({ ids: [], primary: null, source: null });
    setConflict(null);
    return { opened: true, model: next };
  }, []);

  /**
   * Apply an edit. Returns the validation report so the caller can show errors;
   * an invalid edit leaves the model untouched.
   */
  const applyEdit = useCallback(
    (mutate, options) => {
      const current = modelRef.current;
      if (!current) {
        return { ok: false, report: { errors: ['no model is open'], warnings: [] } };
      }
      const result = applyEditToModel(current, mutate, options);
      setReport(result.report);
      if (!result.ok) return result;
      modelRef.current = result.model;
      setModel(result.model);
      pruneSelection(result.model);
      return result;
    },
    [pruneSelection]
  );

  /** Select by canonical id, IFC GlobalId or CAD handle — all resolve to one id. */
  const select = useCallback((identifier, options = {}) => {
    const current = modelRef.current;
    if (!identifier) {
      setSelection({ ids: [], primary: null, source: options.source || null });
      return null;
    }
    const id = current ? resolveElementId(current, identifier, options.kind || 'auto') : null;
    if (!id) {
      setSelection({
        ids: [],
        primary: null,
        source: options.source || null,
        unresolved: String(identifier),
      });
      return null;
    }
    setSelection((previous) => {
      if (options.additive) {
        const ids = previous.ids.includes(id)
          ? previous.ids.filter((entry) => entry !== id)
          : [...previous.ids, id];
        return { ids, primary: ids[ids.length - 1] || null, source: options.source || null };
      }
      return { ids: [id], primary: id, source: options.source || null };
    });
    return id;
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({ ids: [], primary: null, source: null });
  }, []);

  const setVisibility = useCallback((id, visible) => {
    const current = modelRef.current;
    if (!current) return;
    // Visibility is presentation state: stored with the model, but it does not
    // change the revision and cannot invalidate analysis results.
    const hidden = new Set(current.hidden || []);
    if (visible) hidden.delete(id);
    else hidden.add(id);
    const next = { ...current, hidden: [...hidden] };
    modelRef.current = next;
    setModel(next);
  }, []);

  const save = useCallback(() => {
    const current = modelRef.current;
    if (!current) return;
    const next = markSaved(current);
    modelRef.current = next;
    setModel(next);
  }, []);

  /**
   * Edit one element's declared geometry (dimensions / placement / rotation).
   * Validation runs first; a rejected edit leaves the model untouched and returns
   * the report so the form can show the reason.
   */
  const editElement = useCallback(
    (elementId, patch) => {
      const current = modelRef.current;
      const result = editElementGeometry(current, elementId, patch);
      setReport(result.report);
      if (!result.ok) return result;
      modelRef.current = result.model;
      setModel(result.model);
      return result;
    },
    []
  );

  const recordAnalysis = useCallback((results, meta) => {
    const current = modelRef.current;
    if (!current) throw new Error('there is no model to attach analysis results to');
    const next = attachAnalysisResults(current, results, meta);
    modelRef.current = next;
    setModel(next);
    return next;
  }, []);

  /**
   * Record a result document from a different pipeline (e.g. the Framed & Tall
   * builder's `/api/framed_full` response), stamped with the current revision and
   * fingerprint so it is invalidated by later model changes exactly like the
   * OpenSees results.
   */
  const recordAnalysisDocument = useCallback((results, meta) => {
    const current = modelRef.current;
    if (!current) throw new Error('there is no model to attach analysis results to');
    const next = attachAnalysisDocument(current, results, meta);
    modelRef.current = next;
    setModel(next);
    return next;
  }, []);

  /**
   * Merge the identity mapping the backend reports for a generated model
   * (`ifc.guids` from `/generate`, plus the element -> CAD handle links from
   * `/entities/{model}`) into the open model.
   *
   * These are *identifiers*, not engineering values: the revision is deliberately
   * left untouched, so attaching them cannot invalidate analysis results. The
   * mapping is what lets a GlobalId or a DXF handle resolve to the same canonical
   * element in every view.
   */
  const registerIdentity = useCallback(({ guids = {}, handles = {} } = {}) => {
    const current = modelRef.current;
    if (!current) return null;
    const elements = (current.generatorElements || []).map((element) => ({
      ...element,
      guid: element.guid || guids[element.id] || null,
      cadHandles:
        (handles[element.id] && handles[element.id].length
          ? handles[element.id]
          : element.cadHandles) || [],
    }));
    const next = {
      ...current,
      generatorElements: elements,
      identity: buildIdentityIndex({
        members: current.members,
        elements: elements.map((element) => ({
          id: element.id,
          ifc_guid: element.guid,
          ifc_class: element.ifcClass,
          cad_handles: element.cadHandles,
        })),
      }),
    };
    modelRef.current = next;
    setModel(next);
    return next.identity;
  }, []);

  const dismissConflict = useCallback(() => setConflict(null), []);

  const closeModel = useCallback(() => {
    modelRef.current = null;
    setModel(null);
    setSelection({ ids: [], primary: null, source: null });
    setConflict(null);
    persist(null);
  }, []);

  const derived = useMemo(() => {
    const validation = model ? model.validation || validateEngineeringModel(model) : null;
    const readiness = model
      ? analysisReadiness(model)
      : { ready: false, blockers: ['no model open'] };
    const status = model ? analysisStatus(model) : { state: 'none', reason: 'no model open' };
    return {
      validation,
      readiness,
      analysisStatus: status,
      dirty: model ? hasUnsavedChanges(model) : false,
      revision: model?.revision?.index ?? null,
      fingerprint: model ? fingerprintModel(model) : null,
      identity: model?.identity || buildIdentityIndex({}),
    };
  }, [model]);

  const value = useMemo(
    () => ({
      model,
      selection,
      conflict,
      report,
      ...derived,
      loadFromCanonicalDocument,
      loadModel,
      applyEdit,
      editElement,
      select,
      clearSelection,
      setVisibility,
      save,
      recordAnalysis,
      recordAnalysisDocument,
      registerIdentity,
      dismissConflict,
      closeModel,
    }),
    [
      model,
      selection,
      conflict,
      report,
      derived,
      loadFromCanonicalDocument,
      loadModel,
      applyEdit,
      editElement,
      select,
      clearSelection,
      setVisibility,
      save,
      recordAnalysis,
      recordAnalysisDocument,
      registerIdentity,
      dismissConflict,
      closeModel,
    ]
  );

  return (
    <EngineeringModelContext.Provider value={value}>{children}</EngineeringModelContext.Provider>
  );
}

/** Create the initial empty model (used by pages that have no backend yet). */
export function createEmptyModel(modelId = 'untitled') {
  return createEngineeringModel({ modelId, name: modelId });
}

/** Access the shared model. Throws outside a provider so misuse is loud. */
export function useEngineeringModel() {
  const context = useContext(EngineeringModelContext);
  if (!context) {
    throw new Error('useEngineeringModel must be used inside <EngineeringModelProvider>');
  }
  return context;
}

/** Same as above but returns null outside a provider (views that may be embedded). */
export function useOptionalEngineeringModel() {
  return useContext(EngineeringModelContext);
}

export default EngineeringModelContext;
