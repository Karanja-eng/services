import { create } from 'zustand';

export const useElectricalStore = create((set, get) => ({
  elements: {},
  circuits: {},
  
  // View states
  viewMode: '2D', // '2D' or '3D'
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Selection
  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  
  // Active Tool
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
  activePlacementSpec: null,
  setActivePlacementSpec: (spec) => set({ activePlacementSpec: spec }),

  // Actions
  placeElement: (element) => set((state) => {
    const id = element.id || `el_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    return {
      elements: {
        ...state.elements,
        [id]: { ...element, id }
      }
    };
  }),
  
  updateElement: (id, updates) => set((state) => ({
    elements: {
      ...state.elements,
      [id]: { ...state.elements[id], ...updates }
    }
  })),
  
  deleteElement: (id) => set((state) => {
    const newElements = { ...state.elements };
    delete newElements[id];
    return { elements: newElements, selectedElementId: state.selectedElementId === id ? null : state.selectedElementId };
  }),
  
  runConduit: (startId, endId, type, system) => set((state) => {
    const id = `cond_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    return {
      elements: {
        ...state.elements,
        [id]: {
          id,
          elementType: 'conduit',
          subType: type,
          system,
          startId,
          endId,
          points: [] // Will be calculated by a routing engine
        }
      }
    };
  }),
  
  connectToCircuit: (elementId, circuitRef) => set((state) => {
    // 1. Update element
    const newElements = {
      ...state.elements,
      [elementId]: { ...state.elements[elementId], circuitRef }
    };
    
    // 2. Add to circuit list if it exists
    const circuits = { ...state.circuits };
    if (circuits[circuitRef]) {
      circuits[circuitRef] = {
        ...circuits[circuitRef],
        elements: [...new Set([...circuits[circuitRef].elements, elementId])]
      };
    } else {
      circuits[circuitRef] = {
        ref: circuitRef,
        mcbRating: 16,
        cableSize: 2.5,
        rcdProtected: true,
        elements: [elementId]
      };
    }
    
    return { elements: newElements, circuits };
  }),

  // Mock initial state loader
  loadMockData: () => set({
    elements: {
      'test_socket_1': {
        id: 'test_socket_1',
        elementType: 'socket',
        subType: 'uk_13a_2g',
        position: { x: 100, y: 0.45, z: 200 },
        rotation: 0,
        config: { gang: 2, amperage: 13, ipRating: 20 },
        system: 'power',
        circuitRef: 'R1'
      },
      'test_light_1': {
        id: 'test_light_1',
        elementType: 'light',
        subType: 'downlight_led',
        position: { x: 150, y: 2.8, z: 250 },
        rotation: 0,
        config: { wattage: 7, cct: 3000, dimmable: true },
        system: 'lighting',
        circuitRef: 'L1'
      }
    },
    circuits: {
      'R1': { ref: 'R1', mcbRating: 32, cableSize: 2.5, rcdProtected: true, elements: ['test_socket_1'] },
      'L1': { ref: 'L1', mcbRating: 6, cableSize: 1.0, rcdProtected: false, elements: ['test_light_1'] }
    }
  })
}));
