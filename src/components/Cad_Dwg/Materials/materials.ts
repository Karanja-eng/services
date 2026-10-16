/**
 * MaterialLibrary — Singleton PBR material definitions for CAD 3D rendering.
 * Materials are created once and reused across all mesh instances.
 */
import * as THREE from "three";

export type MaterialHint =
  | "concrete"
  | "glass"
  | "metal"
  | "wood"
  | "plastic"
  | "generic";

export interface MaterialConfig {
  hint: MaterialHint;
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
  side?: THREE.Side;
  depthWrite?: boolean;
  wireframe?: boolean;
}

const MATERIAL_CONFIGS: Record<MaterialHint, MaterialConfig> = {
  concrete: {
    hint: "concrete",
    color: "#8a9bb0",
    roughness: 0.95,
    metalness: 0,
  },
  glass: {
    hint: "glass",
    color: "#88aacc",
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.35,
    transmission: 0.85,
  },
  metal: {
    hint: "metal",
    color: "#c0c8d0",
    roughness: 0.2,
    metalness: 0.9,
  },
  wood: {
    hint: "wood",
    color: "#c4913d",
    roughness: 0.85,
    metalness: 0,
  },
  plastic: {
    hint: "plastic",
    color: "#d0d0d0",
    roughness: 0.6,
    metalness: 0.1,
  },
  generic: {
    hint: "generic",
    color: "#cccccc",
    roughness: 0.8,
    metalness: 0,
  },
};

/** Darken a hex color by a factor (0..1) for edge overlays */
export function darkenColor(hex: string, factor = 0.45): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) =>
    Math.round(c * (1 - factor))
      .toString(16)
      .padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
}

// ---------------------------------------------------------------------------
// Singleton material cache
// ---------------------------------------------------------------------------
type MatKey = `${MaterialHint}_${string}`;

const _cache = new Map<string, THREE.Material>();

function cacheKey(hint: MaterialHint, mode: RenderMode, entityColor?: string): MatKey {
  return `${hint}_${mode}_${entityColor ?? ""}`;
}

export type RenderMode = "wireframe" | "solid" | "solid+edges" | "xray";

/**
 * Get (or lazily create) the Three.js material for a given hint + render mode.
 * entityColor is used only for "generic" hint.
 */
export function getMaterial(
  hint: MaterialHint,
  mode: RenderMode,
  entityColor?: string
): THREE.Material {
  const key = cacheKey(hint, mode, entityColor);
  if (_cache.has(key)) return _cache.get(key)!;

  const cfg = MATERIAL_CONFIGS[hint] ?? MATERIAL_CONFIGS.generic;
  const baseColor = hint === "generic" && entityColor ? entityColor : cfg.color;

  let mat: THREE.Material;

  if (mode === "wireframe") {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      wireframe: true,
      roughness: 1,
      metalness: 0,
    });
  } else if (mode === "xray") {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  } else {
    // solid or solid+edges — same underlying material
    if (hint === "glass") {
      mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(baseColor),
        roughness: cfg.roughness,
        metalness: cfg.metalness,
        transparent: true,
        opacity: cfg.opacity ?? 0.35,
        transmission: cfg.transmission ?? 0.85,
        side: THREE.DoubleSide,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor),
        roughness: cfg.roughness,
        metalness: cfg.metalness,
        side: THREE.DoubleSide,
      });
    }
  }

  _cache.set(key, mat);
  return mat;
}

/** Edge overlay material (darker shade of surface color). */
export function getEdgeMaterial(
  hint: MaterialHint,
  entityColor?: string
): THREE.LineBasicMaterial {
  const key = `edge_${hint}_${entityColor ?? ""}`;
  if (_cache.has(key)) return _cache.get(key) as THREE.LineBasicMaterial;
  const cfg = MATERIAL_CONFIGS[hint] ?? MATERIAL_CONFIGS.generic;
  const base = hint === "generic" && entityColor ? entityColor : cfg.color;
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(darkenColor(base, 0.45)),
    linewidth: 1,
  });
  _cache.set(key, mat);
  return mat;
}

/** Dispose all cached materials (call on unmount). */
export function disposeMaterials(): void {
  _cache.forEach((m) => m.dispose());
  _cache.clear();
}

export { MATERIAL_CONFIGS };
