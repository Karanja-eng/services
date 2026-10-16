import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useStore = create(
    subscribeWithSelector((set, get) => ({
        // ─── Tool State ───────────────────────────────────────────────
        selectedTool: 'select',
        setSelectedTool: (tool) => set({ selectedTool: tool, toolOptions: defaultToolOptions[tool] || {} }),

        toolOptions: {},
        setToolOptions: (opts) => set(s => ({ toolOptions: { ...s.toolOptions, ...opts } })),

        // ─── Scene Elements ───────────────────────────────────────────
        elements: [],
        selectedIds: [],

        addElement: (el) => set(s => ({
            elements: [...s.elements, { ...el, id: el.id || crypto.randomUUID() }]
        })),

        updateElement: (id, patch) => set(s => ({
            elements: s.elements.map(e => e.id === id ? { ...e, ...patch } : e)
        })),

        removeElement: (id) => set(s => ({
            elements: s.elements.filter(e => e.id !== id),
            selectedIds: s.selectedIds.filter(sid => sid !== id)
        })),

        selectElement: (id, multi = false) => set(s => ({
            selectedIds: multi
                ? s.selectedIds.includes(id) ? s.selectedIds.filter(sid => sid !== id) : [...s.selectedIds, id]
                : [id]
        })),

        clearSelection: () => set({ selectedIds: [] }),

        getSelected: () => {
            const { elements, selectedIds } = get();
            return elements.filter(e => selectedIds.includes(e.id));
        },

        // ─── Terrain ─────────────────────────────────────────────────
        terrain: null,
        setTerrain: (terrain) => set({ terrain }),

        // ─── View Settings ────────────────────────────────────────────
        gridVisible: true,
        toggleGrid: () => set(s => ({ gridVisible: !s.gridVisible })),

        showMarkings: true,
        toggleMarkings: () => set(s => ({ showMarkings: !s.showMarkings })),

        showTrees: true,
        toggleTrees: () => set(s => ({ showTrees: !s.showTrees })),

        northAngle: 0,
        setNorthAngle: (a) => set({ northAngle: a }),

        scale: 1, // metres per unit
        setScale: (s) => set({ scale: s }),

        // ─── AI Agent ────────────────────────────────────────────────
        agentLog: [],
        pushAgentLog: (msg) => set(s => ({ agentLog: [...s.agentLog.slice(-49), msg] })),

        // ─── History (undo/redo) ──────────────────────────────────────
        history: [],
        future: [],

        snapshot: () => {
            const { elements, terrain } = get();
            set(s => ({ history: [...s.history.slice(-30), { elements, terrain }], future: [] }));
        },

        undo: () => {
            const { history, future, elements, terrain } = get();
            if (!history.length) return;
            const prev = history[history.length - 1];
            set({
                history: history.slice(0, -1),
                future: [{ elements, terrain }, ...future],
                elements: prev.elements,
                terrain: prev.terrain,
            });
        },

        redo: () => {
            const { history, future, elements, terrain } = get();
            if (!future.length) return;
            const next = future[0];
            set({
                history: [...history, { elements, terrain }],
                future: future.slice(1),
                elements: next.elements,
                terrain: next.terrain,
            });
        },
    }))
);

const defaultToolOptions = {
    road: { width: 7, lanes: 2, material: 'asphalt', kerb: 'upstand', markings: ['centre', 'edge'] },
    path: { width: 1.8, material: 'paving', markings: [] },
    driveway: { width: 3.2, material: 'block_paving', markings: [] },
    parking: { bayAngle: 90, bayWidth: 2.5, bayDepth: 5, aisleWidth: 6, material: 'asphalt' },
    tree: { species: 'deciduous', scale: 1 },
    terrain: { resolution: 64 },
    fence: { type: 'close_board', height: 1.8 },
    light: { type: 'bollard' },
};