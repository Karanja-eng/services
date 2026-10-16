import { create } from 'zustand';
import { DEFAULT_STYLE } from '../utils/constants';

export const useAnnotationStore = create((set, get) => ({
  annotations: [],
  selectedId: null,
  activeStyle: { ...DEFAULT_STYLE },

  setSelectedId: (id) => set({ selectedId: id }),

  addAnnotation: (spec) =>
    set((state) => ({ annotations: [...state.annotations, spec] })),

  updateAnnotation: (id, patch) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    })),

  deleteAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  setActiveStyle: (patch) =>
    set((state) => ({ activeStyle: { ...state.activeStyle, ...patch } })),

  clearAll: () => set({ annotations: [], selectedId: null }),

  // Agentic API
  addAnnotationFromSpec: (spec) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    set((state) => ({ annotations: [...state.annotations, { id, ...spec }] }));
    return id;
  },

  generateRoomTags: (rooms) => {
    const newAnns = rooms.map((room) => ({
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'room_tag',
      points: [room.centroid || { x: room.x, y: room.y }],
      text: room.name || 'ROOM',
      area: room.area || 0,
      style: { ...DEFAULT_STYLE },
    }));
    set((state) => ({ annotations: [...state.annotations, ...newAnns] }));
  },

  generateColumnGrid: (columns) => {
    const newAnns = columns.flatMap((col, i) => [{
      id: `grid_${i}_${Date.now()}`,
      type: 'grid_bubble',
      points: [{ x: col.x, y: col.y - 50 }],
      text: String.fromCharCode(65 + i),
      style: { ...DEFAULT_STYLE, dimColor: '#8090b0' },
    }]);
    set((state) => ({ annotations: [...state.annotations, ...newAnns] }));
  },
}));
