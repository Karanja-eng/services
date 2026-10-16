import { useElectricalStore } from '../stores/electricalStore';
import { BS7671_ZONES, ELEMENT_TYPES } from '../utils/constants';

export const calculateCircuitLoad = (circuitRef) => {
  const { circuits, elements } = useElectricalStore.getState();
  const circuit = circuits[circuitRef];
  if (!circuit) return 0;

  return circuit.elements.reduce((sum, elId) => {
    const el = elements[elId];
    if (!el) return sum;
    
    // Convert power to Amps at 240V, or use direct amperage
    if (el.config?.wattage) {
      return sum + (el.config.wattage / 240);
    }
    if (el.config?.amperage) {
      return sum + el.config.amperage;
    }
    return sum;
  }, 0);
};

export const validateCompliance = () => {
  const { circuits, elements } = useElectricalStore.getState();
  const violations = [];

  // 1. Check Circuit Overloads
  Object.values(circuits).forEach(circuit => {
    const load = calculateCircuitLoad(circuit.ref);
    if (load > circuit.mcbRating) {
      violations.push({
        type: 'OVERLOAD',
        severity: 'HIGH',
        message: `Circuit ${circuit.ref} overloaded: ${load.toFixed(2)}A load on ${circuit.mcbRating}A MCB.`,
        elementIds: circuit.elements
      });
    }

    // 2. Check AFDD Requirement (BS 7671 Amd 2)
    // Heuristic: If it's a socket circuit <= 32A, it might need AFDD depending on building type, we just flag it
    if (circuit.mcbRating <= 32 && circuit.elements.some(id => elements[id]?.elementType === ELEMENT_TYPES.SOCKET)) {
      violations.push({
        type: 'RECOMMENDATION',
        severity: 'LOW',
        message: `Circuit ${circuit.ref} (Socket Outlet <= 32A) may require AFDD protection per BS 7671 Regulation 421.1.7.`,
        elementIds: []
      });
    }
  });

  // 3. Bathroom Zone Checking
  // (In a real 3D app, this would use geometry to test against bath/shower volumes)
  // Here we check if any elements manually flagged with zones are non-compliant
  Object.values(elements).forEach(el => {
    if (el.elementType === ELEMENT_TYPES.SOCKET && el.subType !== 'shaver_dual') {
      // Mock condition: If z is very close to a hypothetical bath
      if (el.position && el.position.z < 100 && el.position.x < 100) {
         violations.push({
          type: 'ZONE_VIOLATION',
          severity: 'CRITICAL',
          message: `Element ${el.id} (Standard Socket) located in restricted Zone. Only SELV or Shaver sockets permitted.`,
          elementIds: [el.id]
        });
      }
    }
  });

  return violations;
};
