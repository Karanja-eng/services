import { useMemo } from 'react';
import * as THREE from 'three';
import { MaterialLibrary } from '../materials/MaterialLibrary.js';
import {
  brickVertexShader, brickFragmentShader,
  timberVertexShader, timberFragmentShader,
  concreteVertexShader, concreteFragmentShader,
} from '../shaders/index.js';

const _cache = new Map();

export function getMaterialInstance(name, overrides = {}) {
  const spec = MaterialLibrary[name];
  if (!spec) return new THREE.MeshStandardMaterial({ color: 0xff00ff });
  return buildMaterial({ ...spec, ...overrides });
}

function buildMaterial(merged) {
  const { type, _procedural, _category, _label, ...params } = merged;
  const priv = Object.fromEntries(Object.entries(params).filter(([k]) => k.startsWith('_')));
  const pub  = Object.fromEntries(Object.entries(params).filter(([k]) => !k.startsWith('_')));

  if (_procedural === 'brick') {
    const bc = priv._brickColor  || [0.7,0.33,0.21];
    const mc = priv._mortarColor || [0.75,0.73,0.70];
    return new THREE.ShaderMaterial({
      vertexShader: brickVertexShader, fragmentShader: brickFragmentShader,
      uniforms: {
        uBrickColor:      { value: new THREE.Vector3(...bc) },
        uMortarColor:     { value: new THREE.Vector3(...mc) },
        uBrickWidth:      { value: priv._brickWidth      || 0.22 },
        uBrickHeight:     { value: priv._brickHeight     || 0.075 },
        uMortarThickness: { value: priv._mortarThickness || 0.012 },
        uBondPattern:     { value: priv._bondPattern     || 0.0 },
        uRoughness:       { value: pub.roughness         || 0.88 },
      },
    });
  }

  if (_procedural === 'timber') {
    const wl = priv._woodLight   || [0.85,0.73,0.51];
    const wd = priv._woodDark    || [0.62,0.46,0.28];
    return new THREE.ShaderMaterial({
      vertexShader: timberVertexShader, fragmentShader: timberFragmentShader,
      uniforms: {
        uWoodLight:     { value: new THREE.Vector3(...wl) },
        uWoodDark:      { value: new THREE.Vector3(...wd) },
        uGrainScale:    { value: priv._grainScale    || 8.0 },
        uGrainContrast: { value: priv._grainContrast || 1.4 },
        uRingFrequency: { value: priv._ringFrequency || 12.0 },
      },
    });
  }

  if (_procedural === 'concrete') {
    const c = pub.color || new THREE.Color(0.7,0.69,0.67);
    const cv = c.isColor ? new THREE.Vector3(c.r,c.g,c.b) : new THREE.Vector3(0.7,0.69,0.67);
    return new THREE.ShaderMaterial({
      vertexShader: concreteVertexShader, fragmentShader: concreteFragmentShader,
      uniforms: {
        uBaseColor:     { value: cv },
        uRoughness:     { value: pub.roughness       || 0.75 },
        uNoiseScale:    { value: priv._noiseScale    || 6.0 },
        uNoiseStrength: { value: priv._noiseStrength || 0.18 },
      },
    });
  }

  if (type === 'MeshPhysicalMaterial') return new THREE.MeshPhysicalMaterial(pub);
  return new THREE.MeshStandardMaterial(pub);
}

export function useMaterial(name, overrides = {}) {
  const key = name + '::' + JSON.stringify(overrides);
  return useMemo(() => {
    if (_cache.has(key)) return _cache.get(key);
    const mat = getMaterialInstance(name, overrides);
    _cache.set(key, mat);
    return mat;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function patchMaterial(mat, overrides = {}) {
  Object.entries(overrides).forEach(([k,v]) => {
    if (k === 'color') mat.color?.set(v);
    else if (k in mat) mat[k] = v;
  });
  mat.needsUpdate = true;
}

export default useMaterial;
