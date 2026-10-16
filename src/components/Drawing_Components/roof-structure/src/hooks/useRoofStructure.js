// ─────────────────────────────────────────────────────────────
//  useRoofStructure.js
//  Central React hook — manages all roof structure state,
//  provides generateRoofStructure(spec) agentic entry point,
//  auto-selects truss type from span, and exposes actions.
// ─────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { autoSelectTruss, DEG } from '../constants/roofStructureTypes.js';

// ── Default initial state ─────────────────────────────────────
const DEFAULT_STATE = {
  element:      'truss',   // 'truss' | 'rafters' | 'portal'
  subType:      'king',    // truss type or rafter/portal variant
  span:         8,         // metres
  pitch:        30,        // degrees
  spacing:      0.6,       // metres (truss/rafter centre spacing)
  bays:         5,         // number of trusses or portal bays
  material:     'timber',  // 'timber' | 'steel'
  eaveHeight:   3.5,       // metres (portal frames only)
  haunchLen:    1.2,       // metres (portal frames only)
  baseType:     'fixed',   // 'fixed' | 'pinned' (portal only)
  footprint:    { w: 8, d: 10 }, // metres
  rafterSpacing: 0.6,      // metres
  view:         '3d',      // '3d' | 'elev' | 'plan'
  visibility: {
    chords:  true,
    webs:    true,
    rafters: true,
    purlins: true,
    collar:  true,
    bracing: true,
    gussets: true,
  },
};

export function useRoofStructure(initial = {}) {
  const [state, setState] = useState({ ...DEFAULT_STATE, ...initial });

  // ── Generic setter ─────────────────────────────────────────
  const set = useCallback((patch) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  // ── Set element type — resets subType to sensible default ──
  const setElement = useCallback((element) => {
    const defaults = {
      truss:   { subType: autoSelectTruss(state.span) },
      rafters: { subType: 'common' },
      portal:  { subType: 'fixed' },
    };
    setState(prev => ({ ...prev, element, ...defaults[element] }));
  }, [state.span]);

  // ── Set span — also auto-updates truss type ────────────────
  const setSpan = useCallback((span) => {
    setState(prev => {
      const newSubType = prev.element === 'truss' ? autoSelectTruss(span) : prev.subType;
      return { ...prev, span, subType: newSubType };
    });
  }, []);

  // ── Toggle individual visibility key ──────────────────────
  const toggleVisibility = useCallback((key) => {
    setState(prev => ({
      ...prev,
      visibility: { ...prev.visibility, [key]: !prev.visibility[key] },
    }));
  }, []);

  // ── Set all visibility keys at once ───────────────────────
  const setVisibility = useCallback((visMap) => {
    setState(prev => ({
      ...prev,
      visibility: { ...prev.visibility, ...visMap },
    }));
  }, []);

  // ── Derived computed values ────────────────────────────────
  const derived = computeDerived(state);

  // ── generateRoofStructure(spec) — AI/agentic entry point ──
  // Accepts a full or partial spec JSON and applies it to state.
  // Returns the updated full spec for downstream consumers.
  const generateRoofStructure = useCallback((spec) => {
    const normalised = normaliseSpec(spec);
    setState(prev => {
      const merged = { ...prev, ...normalised };
      // Auto-select truss type if span was supplied
      if (merged.element === 'truss' && spec.span !== undefined) {
        merged.subType = autoSelectTruss(merged.span);
      }
      return merged;
    });
    return { ...state, ...normalised };
  }, [state]);

  // ── Serialise current state to spec JSON ──────────────────
  const toJSON = useCallback(() => {
    return {
      elementType:   state.element,
      subType:       state.subType,
      span:          state.span,
      pitch:         state.pitch,
      spacing:       Math.round(state.spacing * 1000),
      bays:          state.bays,
      material:      state.material,
      eaveHeight:    state.eaveHeight,
      haunchLen:     state.haunchLen,
      baseType:      state.baseType,
      footprint:     state.footprint,
      rafterSpacing: Math.round(state.rafterSpacing * 1000),
      visibility:    state.visibility,
    };
  }, [state]);

  // ── Parse spec JSON string safely ─────────────────────────
  const applyJSONString = useCallback((jsonStr) => {
    try {
      const spec = JSON.parse(jsonStr);
      return generateRoofStructure(spec);
    } catch (e) {
      console.error('[useRoofStructure] Invalid JSON spec:', e.message);
      return null;
    }
  }, [generateRoofStructure]);

  return {
    state,
    derived,
    set,
    setElement,
    setSpan,
    toggleVisibility,
    setVisibility,
    generateRoofStructure,
    toJSON,
    applyJSONString,
  };
}

// ─────────────────────────────────────────────────────────────
//  Derived computed values
// ─────────────────────────────────────────────────────────────
function computeDerived({ span, pitch, bays, spacing, footprint, rafterSpacing }) {
  const rise      = (span / 2) * Math.tan(pitch * DEG);
  const slopeLen  = Math.sqrt(rise * rise + (span / 2) ** 2);
  const totalLen  = (bays - 1) * spacing;
  const roofArea  = slopeLen * 2 * totalLen;
  const numRafters = Math.floor((footprint?.d ?? totalLen) / rafterSpacing) + 2;

  return {
    rise:       Math.round(rise * 1000) / 1000,
    slopeLen:   Math.round(slopeLen * 1000) / 1000,
    totalLen:   Math.round(totalLen * 1000) / 1000,
    roofArea:   Math.round(roofArea * 100) / 100,
    numRafters,
    halfSpan:   span / 2,
  };
}

// ─────────────────────────────────────────────────────────────
//  Normalise an incoming spec object to internal units
//  Converts spacing/rafterSpacing from mm → m if >10
// ─────────────────────────────────────────────────────────────
function normaliseSpec(spec) {
  const out = {};

  if (spec.elementType !== undefined) out.element      = spec.elementType;
  if (spec.element     !== undefined) out.element      = spec.element;
  if (spec.subType     !== undefined) out.subType      = spec.subType;
  if (spec.span        !== undefined) out.span         = Number(spec.span);
  if (spec.pitch       !== undefined) out.pitch        = Number(spec.pitch);
  if (spec.bays        !== undefined) out.bays         = Number(spec.bays);
  if (spec.material    !== undefined) out.material     = spec.material;
  if (spec.eaveHeight  !== undefined) out.eaveHeight   = Number(spec.eaveHeight);
  if (spec.haunchLen   !== undefined) out.haunchLen    = Number(spec.haunchLen);
  if (spec.baseType    !== undefined) out.baseType     = spec.baseType;
  if (spec.footprint   !== undefined) out.footprint    = spec.footprint;
  if (spec.visibility  !== undefined) out.visibility   = spec.visibility;

  if (spec.spacing !== undefined) {
    const v = Number(spec.spacing);
    out.spacing = v > 10 ? v / 1000 : v;  // mm → m
  }
  if (spec.rafterSpacing !== undefined) {
    const v = Number(spec.rafterSpacing);
    out.rafterSpacing = v > 10 ? v / 1000 : v;
  }

  return out;
}
