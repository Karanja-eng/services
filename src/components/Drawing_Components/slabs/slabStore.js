// slabStore.js — Zustand global state for Slab & Floor System module
// Install: npm install zustand

import { create } from 'zustand';
import { checkLdRatio, calcSelfWeight } from './slabTypes';

const defaultSlab = () => ({
  id: `slab-${Date.now()}`,
  type: 'flat',
  footprint: [
    { x: 800,  y: 800  },
    { x: 6400, y: 800  },
    { x: 6400, y: 5200 },
    { x: 800,  y: 5200 },
  ],
  thickness: 250,
  level: 3600,
  ribSpacing: 750,
  ribWidth: 150,
  ribHeight: 200,
  cofferSize: 600,
  waffleGrid: { x: 750, y: 750 },
  drops: [],
  openings: [],
  material: 'concrete',
  finishLevel: 'tile',
});

export const useSlabStore = create((set, get) => ({
  // ── Data ──────────────────────────────────────────────────────
  slabs: [defaultSlab()],
  selectedSlabId: null,

  // ── UI State ──────────────────────────────────────────────────
  activeType: 'flat',
  thickness: 250,
  ribSpacing: 750,
  ribWidth: 150,
  ribHeight: 200,
  cofferSize: 600,
  spanX: 7200,
  spanY: 6000,
  ffl: 3600,
  imposedLoad: 4.0,
  showGrid: true,
  showAnnotations: true,
  tool: 'select',          // 'select' | 'polygon' | 'opening' | 'dimension'
  view: 'plan',            // 'plan' | 'section' | '3d'
  drawingPoints: [],
  openings: [],
  drops: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  aiResponse: '',

  // ── Computed ──────────────────────────────────────────────────
  getStructuralCheck: () => {
    const s = get();
    const span = Math.max(s.spanX, s.spanY);
    const ld = checkLdRatio(span, s.thickness, s.activeType);
    const sw = calcSelfWeight(s.thickness);
    return { ld, sw, totalLoad: sw + s.imposedLoad };
  },

  getSelectedSlab: () => {
    const { slabs, selectedSlabId } = get();
    return slabs.find(s => s.id === selectedSlabId) || null;
  },

  // ── Actions ───────────────────────────────────────────────────
  setActiveType: (type) => set({ activeType: type }),
  setThickness: (v) => set({ thickness: Number(v) }),
  setRibSpacing: (v) => set({ ribSpacing: Number(v) }),
  setRibWidth: (v) => set({ ribWidth: Number(v) }),
  setRibHeight: (v) => set({ ribHeight: Number(v) }),
  setCofferSize: (v) => set({ cofferSize: Number(v) }),
  setSpanX: (v) => set({ spanX: Number(v) }),
  setSpanY: (v) => set({ spanY: Number(v) }),
  setFFL: (v) => set({ ffl: Number(v) }),
  setImposedLoad: (v) => set({ imposedLoad: Number(v) }),
  setTool: (tool) => set({ tool, drawingPoints: [] }),
  setView: (view) => set({ view }),
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleAnnotations: () => set(s => ({ showAnnotations: !s.showAnnotations })),
  setZoom: (z) => set({ zoom: z }),
  setPan: (pan) => set({ pan }),
  setAIResponse: (msg) => set({ aiResponse: msg }),

  addDrawingPoint: (pt) => set(s => ({ drawingPoints: [...s.drawingPoints, pt] })),
  clearDrawingPoints: () => set({ drawingPoints: [] }),

  // ── Slab CRUD ─────────────────────────────────────────────────
  addSlab: (slabData) => {
    const newSlab = { ...defaultSlab(), ...slabData, id: `slab-${Date.now()}` };
    set(s => ({ slabs: [...s.slabs, newSlab], selectedSlabId: newSlab.id }));
    return newSlab.id;
  },

  updateSlab: (id, changes) => set(s => ({
    slabs: s.slabs.map(sl => sl.id === id ? { ...sl, ...changes } : sl),
  })),

  deleteSlab: (id) => set(s => ({
    slabs: s.slabs.filter(sl => sl.id !== id),
    selectedSlabId: s.selectedSlabId === id ? null : s.selectedSlabId,
  })),

  selectSlab: (id) => set({ selectedSlabId: id }),

  clearAll: () => set({ slabs: [], selectedSlabId: null, drawingPoints: [], openings: [] }),

  finalizePolygon: () => {
    const s = get();
    if (s.drawingPoints.length < 3) return;
    const newSlab = {
      ...defaultSlab(),
      id: `slab-${Date.now()}`,
      type: s.activeType,
      footprint: [...s.drawingPoints],
      thickness: s.thickness,
      ribSpacing: s.ribSpacing,
      ribWidth: s.ribWidth,
      ribHeight: s.ribHeight,
      cofferSize: s.cofferSize,
      waffleGrid: { x: s.ribSpacing, y: s.ribSpacing },
      level: s.ffl,
      openings: [...s.openings],
    };
    set(st => ({
      slabs: [...st.slabs, newSlab],
      selectedSlabId: newSlab.id,
      drawingPoints: [],
      tool: 'select',
    }));
  },

  // ── Openings ──────────────────────────────────────────────────
  addOpening: (opening) => {
    const op = { id: `op-${Date.now()}`, x: 3600, y: 3000, width: 1200, height: 800, ...opening };
    set(s => ({ openings: [...s.openings, op] }));
  },
  removeOpening: (id) => set(s => ({ openings: s.openings.filter(o => o.id !== id) })),

  // ── Copy to floor ─────────────────────────────────────────────
  copySlabToFloor: (id, levelOffset) => {
    const { slabs } = get();
    const src = slabs.find(s => s.id === id);
    if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)), id: `slab-${Date.now()}`, level: src.level + levelOffset };
    set(s => ({ slabs: [...s.slabs, copy], selectedSlabId: copy.id }));
    return copy.id;
  },

  // ── Import/Export ─────────────────────────────────────────────
  importJSON: (spec) => {
    const s = get();
    if (spec.type) set({ activeType: spec.type });
    if (spec.thickness) set({ thickness: spec.thickness });
    if (spec.ribSpacing) set({ ribSpacing: spec.ribSpacing });
    if (spec.ribWidth) set({ ribWidth: spec.ribWidth });
    if (spec.cofferSize) set({ cofferSize: spec.cofferSize });
    if (spec.finishLevel || spec.ffl) set({ ffl: spec.finishLevel || spec.ffl });
    if (spec.footprint) {
      const xs = spec.footprint.map(p => p.x);
      const ys = spec.footprint.map(p => p.y);
      set({ spanX: Math.max(...xs), spanY: Math.max(...ys) });
    }
    const newSlab = {
      ...defaultSlab(),
      ...spec,
      id: `slab-${Date.now()}`,
      level: spec.finishLevel || spec.ffl || get().ffl,
    };
    set(st => ({ slabs: [...st.slabs, newSlab], selectedSlabId: newSlab.id }));
  },

  exportJSON: () => {
    const s = get();
    const slab = s.getSelectedSlab() || s.slabs[0];
    return JSON.stringify({
      type: s.activeType,
      footprint: slab?.footprint || [],
      thickness: s.thickness,
      ribSpacing: s.ribSpacing,
      ribWidth: s.ribWidth,
      ribHeight: s.ribHeight,
      cofferSize: s.cofferSize,
      waffleGrid: { x: s.ribSpacing, y: s.ribSpacing },
      drops: slab?.drops || [],
      openings: s.openings,
      material: 'concrete',
      finishLevel: s.ffl,
    }, null, 2);
  },

  // ── generateSlab — agentic entry point ────────────────────────
  generateSlab: (spec = {}) => {
    const s = get();
    const margin = 800;
    const spanX = spec.footprint ? Math.max(...spec.footprint.map(p => p.x)) : s.spanX;
    const spanY = spec.footprint ? Math.max(...spec.footprint.map(p => p.y)) : s.spanY;
    const fp = spec.footprint || [
      { x: margin,        y: margin },
      { x: spanX - margin, y: margin },
      { x: spanX - margin, y: spanY - margin },
      { x: margin,        y: spanY - margin },
    ];
    const slabSpec = {
      type:       spec.type       || s.activeType,
      footprint:  fp,
      thickness:  spec.thickness  || s.thickness,
      ribSpacing: spec.ribSpacing || s.ribSpacing,
      ribWidth:   spec.ribWidth   || s.ribWidth,
      ribHeight:  spec.ribHeight  || s.ribHeight,
      cofferSize: spec.cofferSize || s.cofferSize,
      waffleGrid: spec.waffleGrid || { x: s.ribSpacing, y: s.ribSpacing },
      drops:      spec.drops      || [],
      openings:   spec.openings   || s.openings,
      material:   spec.material   || 'concrete',
      level:      spec.finishLevel || spec.ffl || s.ffl,
    };
    const id = get().addSlab(slabSpec);
    // L/d warning
    const span = Math.max(spanX, spanY);
    const ld = checkLdRatio(span, slabSpec.thickness, slabSpec.type);
    if (!ld.ok) {
      set({ aiResponse: `⚠ L/d = ${ld.actual} exceeds limit ${ld.limit}. Minimum thickness for this span: ${ld.minThickness}mm.` });
    } else {
      set({ aiResponse: `✓ ${slabSpec.type} slab generated — ${slabSpec.thickness}mm @ FFL+${slabSpec.level}mm. L/d = ${ld.actual} ✓` });
    }
    return id;
  },
}));
