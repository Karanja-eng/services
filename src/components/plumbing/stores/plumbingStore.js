import { create } from 'zustand';

export const usePlumbingStore = create((set, get) => ({
  plumbingElements: {},
  pipeRoutes: {},
  
  viewMode: '2D', // '2D' or '3D'
  setViewMode: (mode) => set({ viewMode: mode }),
  
  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  activePlacementSpec: null,
  setActivePlacementSpec: (spec) => set({ activePlacementSpec: spec }),

  placeElement: (element) => set((state) => {
    const id = element.id || `plumb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    return {
      plumbingElements: {
        ...state.plumbingElements,
        [id]: { ...element, id }
      }
    };
  }),
  
  updateElement: (id, updates) => set((state) => ({
    plumbingElements: {
      ...state.plumbingElements,
      [id]: { ...state.plumbingElements[id], ...updates }
    }
  })),
  
  deleteElement: (id) => set((state) => {
    const newElements = { ...state.plumbingElements };
    delete newElements[id];
    return { plumbingElements: newElements, selectedElementId: state.selectedElementId === id ? null : state.selectedElementId };
  }),
  
  routePipe: (id, spec) => set((state) => {
    const pipeId = id || `pipe_${Date.now()}`;
    return {
      pipeRoutes: {
        ...state.pipeRoutes,
        [pipeId]: { ...spec, id: pipeId }
      }
    };
  }),

  loadMockData: () => set({
    plumbingElements: {
      'wc_1': {
        id: 'wc_1',
        category: 'fixture',
        subType: 'Close-coupled WC',
        position: { x: 50, y: 0, z: 50 },
        rotation: 0,
        config: { material: 'Ceramic' }
      },
      'basin_1': {
        id: 'basin_1',
        category: 'fixture',
        subType: 'Wall-hung Basin',
        position: { x: 100, y: 0.85, z: 50 },
        rotation: 0,
        config: { material: 'Ceramic' }
      },
      'cwst_1': {
        id: 'cwst_1',
        category: 'vessel',
        subType: 'Cold Water Storage Tank',
        position: { x: 75, y: 3, z: 50 },
        rotation: 0,
        config: { capacity: 1000 }
      }
    },
    pipeRoutes: {
      'pipe_cws_1': {
        id: 'pipe_cws_1',
        system: 'CWS',
        material: 'PPR',
        size: 20,
        points: [{x: 75, y: 3, z: 50}, {x: 75, y: 0.85, z: 50}, {x: 100, y: 0.85, z: 50}]
      }
    }
  })
}));
