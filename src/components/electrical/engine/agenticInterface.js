import { useElectricalStore } from '../stores/electricalStore';
import { validateCompliance } from './complianceEngine';

// API callable by AI Agents to manipulate the electrical system
export const AgenticElectricalAPI = {
  
  /**
   * Place a new electrical element in the store.
   * @param {Object} spec Element specification.
   */
  placeElement: (spec) => {
    const store = useElectricalStore.getState();
    store.placeElement(spec);
    return `Element placed: ${spec.subType}`;
  },

  /**
   * Automatically routes conduit between two elements.
   * @param {string} startId ID of start element
   * @param {string} endId ID of end element
   * @param {string} type Conduit type (e.g. PVC, Steel)
   * @param {string} system System (power, data, fire)
   */
  runConduit: (startId, endId, type = 'pvc_20mm', system = 'power') => {
    const store = useElectricalStore.getState();
    store.runConduit(startId, endId, type, system);
    return `Conduit routed between ${startId} and ${endId}`;
  },

  /**
   * Generates a lighting layout for a rectangular room.
   */
  generateLightingLayout: (width, length, fixtureType, targetLux = 300) => {
    // Simplified calculation for demo
    const area = width * length;
    const numFixtures = Math.ceil(area / 4); // Fake assumption: 1 fixture per 4sqm
    
    const store = useElectricalStore.getState();
    for (let i = 0; i < numFixtures; i++) {
      store.placeElement({
        elementType: 'light',
        subType: fixtureType,
        position: { x: Math.random() * width, y: 2.8, z: Math.random() * length },
        config: { wattage: 10, cct: 4000 },
        system: 'lighting'
      });
    }
    return `Generated ${numFixtures} lighting fixtures for ${area} sqm room to target ${targetLux} lux.`;
  },

  /**
   * Run compliance check and return issues.
   */
  runComplianceCheck: () => {
    return validateCompliance();
  }
};
