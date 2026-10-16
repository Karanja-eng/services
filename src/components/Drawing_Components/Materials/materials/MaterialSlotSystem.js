import { create } from 'zustand';
import { getMaterialInstance, patchMaterial } from '../hooks/useMaterial.js';

export const SLOT_TEMPLATES = {
  window:  ['frame','glazing','threshold','cill'],
  door:    ['frame','leaf','glazing','threshold','hardware'],
  wall:    ['face','reveal','plinth'],
  roof:    ['covering','fascia','soffit','gutter'],
  column:  ['shaft','base','cap'],
  floor:   ['finish','skirting'],
  facade:  ['cladding','frame','glazing','sill'],
  generic: ['surface'],
};

export const useMaterialSlotStore = create((set, get) => ({
  slots: {},

  initElement(elementId, template='generic', defaults={}) {
    const names = SLOT_TEMPLATES[template] || SLOT_TEMPLATES.generic;
    const slots = {};
    names.forEach(slot => {
      const mat = defaults[slot] || 'paint_flat_white';
      slots[slot] = { materialName: mat, overrides:{}, instance: getMaterialInstance(mat) };
    });
    set(s => ({ slots: { ...s.slots, [elementId]: slots } }));
  },

  assignMaterial(elementId, slotName, materialName, overrides={}) {
    const instance = getMaterialInstance(materialName, overrides);
    set(s => ({
      slots: { ...s.slots, [elementId]: { ...(s.slots[elementId]||{}), [slotName]: { materialName, overrides, instance } } }
    }));
  },

  patchSlot(elementId, slotName, overrides) {
    const slot = get().slots[elementId]?.[slotName];
    if (!slot) return;
    patchMaterial(slot.instance, overrides);
    set(s => ({
      slots: { ...s.slots, [elementId]: { ...s.slots[elementId], [slotName]: { ...slot, overrides: { ...slot.overrides, ...overrides } } } }
    }));
  },

  getSlotMaterial: (elementId, slotName) => get().slots[elementId]?.[slotName]?.instance ?? null,
  getElementSlots: (elementId) => get().slots[elementId] ?? {},
  removeElement: (elementId) => set(s => { const n={...s.slots}; delete n[elementId]; return {slots:n}; }),
}));

export function applyMaterial({ elementId, materialSlot, materialName, overrides={} }) {
  useMaterialSlotStore.getState().assignMaterial(elementId, materialSlot, materialName, overrides);
}
