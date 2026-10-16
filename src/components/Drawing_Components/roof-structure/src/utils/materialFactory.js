// ─────────────────────────────────────────────────────────────
//  materialFactory.js
//  All MeshStandardMaterial presets for structural members.
//  Call createMaterials(materialType) to get a full set.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';

function mat(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// ── Timber materials ─────────────────────────────────────────
export const TIMBER_MATS = {
  chord:   mat(0xc8a060, 0.85, 0.00),
  web:     mat(0xb08040, 0.85, 0.00),
  rafter:  mat(0xd4a864, 0.85, 0.00),
  purlin:  mat(0x9a7040, 0.85, 0.00),
  collar:  mat(0xb08040, 0.80, 0.00),
  brace:   mat(0x8d6e50, 0.85, 0.00),
  ridge:   mat(0xd4a060, 0.82, 0.00),
  hip:     mat(0xe07020, 0.80, 0.00),
  valley:  mat(0x9060b0, 0.80, 0.00),
  gusset:  mat(0x9e9e9e, 0.50, 0.30),
  column:  mat(0xb08040, 0.85, 0.00),
  haunch:  mat(0xb08040, 0.85, 0.00),
};

// ── Steel materials ──────────────────────────────────────────
export const STEEL_MATS = {
  chord:   mat(0x607d8b, 0.20, 0.85),
  web:     mat(0x546e7a, 0.20, 0.85),
  rafter:  mat(0x607d8b, 0.20, 0.85),
  purlin:  mat(0x607d8b, 0.20, 0.85),
  collar:  mat(0x546e7a, 0.20, 0.85),
  brace:   mat(0x607d8b, 0.20, 0.85),
  ridge:   mat(0x78909c, 0.18, 0.88),
  hip:     mat(0x7c6faa, 0.20, 0.85),
  valley:  mat(0x9333ea, 0.20, 0.85),
  gusset:  mat(0x9e9e9e, 0.30, 0.60),
  column:  mat(0x546e7a, 0.18, 0.88),
  haunch:  mat(0x7c6faa, 0.20, 0.85),
};

// ── Shared structural mats (material-agnostic) ───────────────
export const SHARED_MATS = {
  concrete_base: mat(0x9e9e9e, 0.90, 0.00),
  floor:         mat(0x161922, 0.95, 0.00),
};

// ── Factory ──────────────────────────────────────────────────
// materialType: 'timber' | 'steel'
export function createMaterials(materialType = 'timber') {
  return materialType === 'steel' ? STEEL_MATS : TIMBER_MATS;
}

// ── Dispose all materials in a set ───────────────────────────
export function disposeMaterials(matsObj) {
  Object.values(matsObj).forEach(m => m?.dispose?.());
}
