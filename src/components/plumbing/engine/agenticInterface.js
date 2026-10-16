import { usePlumbingStore } from '../stores/plumbingStore';
import { validatePlumbingCompliance, estimateWaterConsumption } from './complianceEngine';

export const AgenticPlumbingAPI = {
  placePlumbingElement: (spec) => {
    const store = usePlumbingStore.getState();
    store.placeElement(spec);
    return `Element placed: ${spec.subType}`;
  },

  routePipe: (spec) => {
    const store = usePlumbingStore.getState();
    store.routePipe(spec.id, spec);
    return `Pipe routed: ${spec.system} (${spec.size}mm ${spec.material})`;
  },

  generateBathroomLayout: (width, length) => {
    const store = usePlumbingStore.getState();
    // Rough mock placement
    store.placeElement({
      category: 'fixture', subType: 'Close-coupled WC', position: { x: 0.5, y: 0, z: length - 0.5 }, config: {}
    });
    store.placeElement({
      category: 'fixture', subType: 'Wall-hung Basin', position: { x: width - 0.5, y: 0.85, z: length - 0.5 }, config: {}
    });
    store.placeElement({
      category: 'fixture', subType: 'Shower', position: { x: 0.5, y: 0, z: 0.5 }, config: {}
    });
    return `Generated standard bathroom layout for ${width}x${length} space.`;
  },

  runComplianceCheck: () => {
    return validatePlumbingCompliance();
  },

  getWaterDemandEstimate: () => {
    return estimateWaterConsumption();
  }
};
