import { create } from 'zustand'
import { v4 as uuid } from 'uuid'

const DEFAULT_SECTION_PROPS = {
  rectangular_rc: { width: 0.4, depth: 0.4, rebarCount: 8, rebarDia: 16, cover: 40 },
  circular_rc:    { diameter: 0.5, rebarCount: 8, rebarDia: 16, cover: 40 },
  l_shaped:       { b1: 0.4, d1: 0.6, b2: 0.6, d2: 0.15 },
  t_shaped:       { bw: 0.4, h: 0.6, bf: 0.8, tf: 0.15 },
  steel_i:        { H: 0.3, B: 0.15, tw: 0.01, tf: 0.015, r: 0.008 },
  steel_hollow:   { B: 0.2, D: 0.2, t: 0.01 },
  timber:         { width: 0.2, depth: 0.3 },
  composite:      { outerD: 0.5, steelH: 0.2, steelB: 0.1, steelTw: 0.008, steelTf: 0.012 },
  classical:      { baseDia: 0.7, shaftTopDia: 0.45, shaftBotDia: 0.55, capitalH: 0.3, baseH: 0.3 },
  // beams
  rectangular_beam: { width: 0.3, depth: 0.5, rebarCount: 4, rebarDia: 20 },
  t_beam:           { bw: 0.3, hw: 0.45, bf: 0.9, tf: 0.15 },
  l_beam:           { bw: 0.3, hw: 0.45, bf: 0.5, tf: 0.15 },
  steel_i_beam:     { H: 0.45, B: 0.19, tw: 0.01, tf: 0.015, r: 0.01 },
  steel_channel:    { H: 0.3, B: 0.1, tw: 0.009, tf: 0.014 },
  steel_hollow_beam:{ B: 0.25, D: 0.15, t: 0.01 },
  timber_beam:      { width: 0.2, depth: 0.45, layers: 5 },
  pt_beam:          { width: 0.35, depth: 0.6, tendons: 4 },
  cantilever_beam:  { width: 0.3, depthRoot: 0.6, depthTip: 0.3 },
  transfer_beam:    { width: 0.5, depth: 1.2, rebarCount: 6, rebarDia: 25 },
}

export const useStore = create((set, get) => ({
  // ─── View ──────────────────────────────────────────────
  activeView: '2d',         // '2d' | '3d'
  activeTool: 'select',     // 'select' | 'place_column' | 'place_beam'
  setActiveView: (v) => set({ activeView: v }),
  setActiveTool: (t) => set({ activeTool: t }),

  // ─── Element types ─────────────────────────────────────
  selectedColumnType: 'rectangular_rc',
  selectedBeamType:   'rectangular_beam',
  setSelectedColumnType: (t) => set({ selectedColumnType: t }),
  setSelectedBeamType:   (t) => set({ selectedBeamType: t }),

  // ─── Active section props ───────────────────────────────
  activeSectionProps: DEFAULT_SECTION_PROPS.rectangular_rc,
  setActiveSectionProps: (p) => set((s) => ({
    activeSectionProps: { ...s.activeSectionProps, ...p }
  })),

  // ─── Levels ─────────────────────────────────────────────
  levels: [
    { id: 'L0', name: 'Ground', elevation: 0 },
    { id: 'L1', name: 'Level 1', elevation: 3.5 },
    { id: 'L2', name: 'Level 2', elevation: 7.0 },
  ],
  activeBaseLevel: 'L0',
  activeTopLevel:  'L1',
  setActiveBaseLevel: (id) => set({ activeBaseLevel: id }),
  setActiveTopLevel:  (id) => set({ activeTopLevel: id }),

  // ─── Elements ───────────────────────────────────────────
  columns: [],
  beams: [],
  selectedId: null,
  beamStart: null,    // id of first column for beam placement
  setSelectedId: (id) => set({ selectedId: id }),
  setBeamStart: (id) => set({ beamStart: id }),

  // ─── Scale: 1 unit = 1 metre; plan pixels per metre ─────
  planScale: 60,   // px/m on 2D plan
  setPlanScale: (s) => set({ planScale: s }),

  // ─── Column CRUD ────────────────────────────────────────
  addColumn: (x, y) => {
    const s = get()
    const levels = s.levels
    const baseEl = levels.find(l => l.id === s.activeBaseLevel)?.elevation ?? 0
    const topEl  = levels.find(l => l.id === s.activeTopLevel)?.elevation  ?? 3.5
    const col = {
      id: uuid(),
      type: s.selectedColumnType,
      x, y,
      baseLevel: s.activeBaseLevel,
      topLevel:  s.activeTopLevel,
      baseElevation: baseEl,
      topElevation:  topEl,
      sectionProps: { ...DEFAULT_SECTION_PROPS[s.selectedColumnType] },
      material: s.selectedColumnType.includes('steel') ? 'steel'
               : s.selectedColumnType === 'timber' ? 'timber'
               : s.selectedColumnType === 'classical' ? 'concrete'
               : 'concrete',
      gridRef: '',
    }
    set((st) => ({ columns: [...st.columns, col] }))
    return col
  },

  updateColumn: (id, patch) => set((s) => ({
    columns: s.columns.map(c => c.id === id ? { ...c, ...patch } : c)
  })),

  deleteColumn: (id) => set((s) => ({
    columns: s.columns.filter(c => c.id !== id),
    beams:   s.beams.filter(b => b.startColId !== id && b.endColId !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
  })),

  // ─── Beam CRUD ──────────────────────────────────────────
  addBeam: (startColId, endColId) => {
    const s = get()
    const startCol = s.columns.find(c => c.id === startColId)
    const endCol   = s.columns.find(c => c.id === endColId)
    if (!startCol || !endCol || startColId === endColId) return null
    const beam = {
      id: uuid(),
      type: s.selectedBeamType,
      startColId, endColId,
      topLevel:  s.activeTopLevel,
      elevation: startCol.topElevation,
      sectionProps: { ...DEFAULT_SECTION_PROPS[s.selectedBeamType] },
      material: s.selectedBeamType.includes('steel') ? 'steel'
               : s.selectedBeamType === 'timber_beam' ? 'timber'
               : 'concrete',
      haunch: false,
      haunchLength: 0.5,
      haunchDepth: 0.15,
    }
    set((st) => ({ beams: [...st.beams, beam] }))
    return beam
  },

  updateBeam: (id, patch) => set((s) => ({
    beams: s.beams.map(b => b.id === id ? { ...b, ...patch } : b)
  })),

  deleteBeam: (id) => set((s) => ({
    beams: s.beams.filter(b => b.id !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
  })),

  // ─── Grid generator ─────────────────────────────────────
  generateColumnGrid: ({ originX, originY, bayX, bayY, countX, countY, columnType }) => {
    const s = get()
    const cols = []
    const gridLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let row = 0; row < countY; row++) {
      for (let col = 0; col < countX; col++) {
        const x = originX + col * bayX
        const y = originY + row * bayY
        const baseEl = s.levels.find(l => l.id === s.activeBaseLevel)?.elevation ?? 0
        const topEl  = s.levels.find(l => l.id === s.activeTopLevel)?.elevation  ?? 3.5
        const newCol = {
          id: uuid(),
          type: columnType || s.selectedColumnType,
          x, y,
          baseLevel: s.activeBaseLevel,
          topLevel:  s.activeTopLevel,
          baseElevation: baseEl,
          topElevation:  topEl,
          sectionProps: { ...DEFAULT_SECTION_PROPS[columnType || s.selectedColumnType] },
          material: (columnType || s.selectedColumnType).includes('steel') ? 'steel' : 'concrete',
          gridRef: `${gridLetters[row]}${col + 1}`,
        }
        cols.push(newCol)
      }
    }
    set((st) => ({ columns: [...st.columns, ...cols] }))
    return cols
  },

  // ─── Agentic interface ──────────────────────────────────
  placeStructuralElement: (spec) => {
    const s = get()
    if (spec.elementType === 'column') {
      const baseEl = s.levels.find(l => l.id === spec.baseLevel)?.elevation ?? 0
      const topEl  = s.levels.find(l => l.id === spec.topLevel)?.elevation  ?? 3.5
      const col = {
        id: uuid(),
        type: spec.subType,
        x: spec.position.x,
        y: spec.position.y,
        baseLevel: spec.baseLevel || s.activeBaseLevel,
        topLevel:  spec.topLevel  || s.activeTopLevel,
        baseElevation: baseEl,
        topElevation:  topEl,
        sectionProps: { ...DEFAULT_SECTION_PROPS[spec.subType], ...spec.sectionProps },
        material: spec.material || 'concrete',
        gridRef: spec.gridRef || '',
      }
      set((st) => ({ columns: [...st.columns, col] }))
      return col
    }
    return null
  },

  // ─── Warnings ───────────────────────────────────────────
  getBeamWarnings: () => {
    const { beams, columns } = get()
    return beams.map(beam => {
      const sc = columns.find(c => c.id === beam.startColId)
      const ec = columns.find(c => c.id === beam.endColId)
      if (!sc || !ec) return null
      const span = Math.sqrt((ec.x - sc.x) ** 2 + (ec.y - sc.y) ** 2)
      const props = beam.sectionProps
      const depth = props.depth || props.hw || props.H || 0.5
      const ratio = span / depth
      const ok = ratio <= 18
      return { beamId: beam.id, span: span.toFixed(2), depth: depth.toFixed(2), ratio: ratio.toFixed(1), ok }
    }).filter(Boolean)
  },
}))

export { DEFAULT_SECTION_PROPS }