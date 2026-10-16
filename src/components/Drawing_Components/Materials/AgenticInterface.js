import { applyMaterial as _apply } from './materials/MaterialSlotSystem.js';
import { setLighting as _setLighting } from './lighting/LightingSystem.jsx';
import { useRenderStore } from './rendering/RenderingEngine.jsx';
import { MaterialLibrary } from './materials/MaterialLibrary.js';

export function applyMaterial(spec) {
  const { elementId, materialSlot, materialName, overrides={} } = spec;
  if (!elementId||!materialSlot||!materialName) return { success:false, error:'Missing fields' };
  if (!MaterialLibrary[materialName]) return { success:false, error:`Unknown material: ${materialName}` };
  _apply({ elementId, materialSlot, materialName, overrides });
  return { success:true, ...spec };
}

export function setLighting(mode, params={}) {
  const valid = ['architectural','daylight','night','golden_hour'];
  if (!valid.includes(mode)) return { success:false, error:`Invalid mode. Use: ${valid.join(', ')}` };
  _setLighting(mode, params);
  return { success:true, mode, params };
}

export function renderScene(options={}) {
  const s = useRenderStore.getState();
  if (options.mode) s.setRenderMode(options.mode);
  if (options.resolution) s.setResolution(options.resolution);
  if (typeof options.postProcessing==='boolean' && options.postProcessing!==s.postProcessing) s.togglePostProcessing();
  return { success:true };
}

export function queryMaterials({ category, search }={}) {
  return Object.entries(MaterialLibrary)
    .filter(([id,spec]) => {
      if (category && spec._category!==category) return false;
      if (search && !(spec._label||id).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .map(([id,spec]) => ({ id, label:spec._label||id, category:spec._category, type:spec.type }));
}

export function batch(ops=[]) {
  return ops.map(op => {
    if (op.type==='applyMaterial') return applyMaterial(op);
    if (op.type==='setLighting')   return setLighting(op.mode, op.params);
    if (op.type==='renderScene')   return renderScene(op.options);
    return { success:false, error:`Unknown op: ${op.type}` };
  });
}

export const ArchStudioAPI = { applyMaterial, setLighting, renderScene, queryMaterials, batch };
export default ArchStudioAPI;
