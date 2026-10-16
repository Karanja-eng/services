import { usePlumbingStore } from '../stores/plumbingStore';
import { ELEMENT_CATEGORIES } from '../utils/constants';

export const validatePlumbingCompliance = () => {
  const { pipeRoutes, plumbingElements } = usePlumbingStore.getState();
  const violations = [];

  // 1. Drain Gradient Checks
  Object.values(pipeRoutes).forEach(route => {
    if (['SVP', 'WASTE'].includes(route.system) && route.gradient) {
      const gradientParts = route.gradient.split(':');
      if (gradientParts.length === 2) {
        const fall = parseInt(gradientParts[1]);
        // For 110mm pipe, fall should typically be between 1:40 and 1:80
        if (route.size === 110 && (fall < 40 || fall > 80)) {
           violations.push({
             type: 'GRADIENT_VIOLATION',
             severity: 'HIGH',
             message: `Drainage route ${route.id} has a gradient of ${route.gradient}. For 110mm pipe, BS EN 12056 recommends between 1:40 and 1:80.`
           });
        }
      }
    }
  });

  // 2. Storage Tank Elevation
  const storageTanks = Object.values(plumbingElements).filter(el => el.category === ELEMENT_CATEGORIES.VESSEL && el.subType.includes('Storage Tank'));
  const fixtures = Object.values(plumbingElements).filter(el => el.category === ELEMENT_CATEGORIES.FIXTURE);
  
  if (storageTanks.length > 0 && fixtures.length > 0) {
     const minTankElevation = Math.min(...storageTanks.map(t => t.position.y));
     const maxFixtureElevation = Math.max(...fixtures.map(f => f.position.y));
     
     if (minTankElevation < maxFixtureElevation + 1) { // 1 meter head minimum
       violations.push({
         type: 'HEAD_PRESSURE',
         severity: 'CRITICAL',
         message: `Cold water storage tank is positioned too low to provide adequate gravity pressure to the highest fixture.`
       });
     }
  }

  // 3. Legionella Risk / Dead Legs (Heuristic mock)
  Object.values(pipeRoutes).forEach(route => {
    if (route.system === 'HWS' && !route.isCirculating) {
      // If we had length calculation, we would flag lengths > 3m or whatever local code specifies
      violations.push({
         type: 'LEGIONELLA_RISK',
         severity: 'MEDIUM',
         message: `Route ${route.id} is a dead-leg on the HWS system. Ensure length is minimized or install trace heating/recirculation.`
      });
    }
  });

  return violations;
};

export const estimateWaterConsumption = () => {
   const { plumbingElements } = usePlumbingStore.getState();
   let totalLitersPerDay = 0;
   
   // Very rough estimator based on fixture count
   Object.values(plumbingElements).forEach(el => {
     if (el.category === ELEMENT_CATEGORIES.FIXTURE) {
       if (el.subType.includes('WC')) totalLitersPerDay += 50; // 50L per WC per day
       if (el.subType.includes('Basin')) totalLitersPerDay += 30;
       if (el.subType.includes('Shower')) totalLitersPerDay += 80;
       if (el.subType.includes('Bath')) totalLitersPerDay += 150;
     }
   });
   
   return totalLitersPerDay;
};
