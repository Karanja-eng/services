// ─────────────────────────────────────────────────────────────
//  geometryUtils.js
//  Pure Three.js geometry helpers — no React dependency.
//  Works with both vanilla Three.js and React Three Fiber refs.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';

// ── Dispose all meshes inside a Three.js Group ───────────────
export function disposeGroup(group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    if (child.geometry)  child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => m.dispose());
    }
    if (child.children?.length) disposeGroup(child);
    group.remove(child);
  }
}

// ── Create a BoxGeometry member extruded from start→end ──────
// start, end  : THREE.Vector3
// w, h        : cross-section dimensions (metres)
// mat         : THREE.Material
// returns     : THREE.Mesh | null
export function memberMesh(start, end, w, h, mat, { castShadow = true, receiveShadow = true } = {}) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  if (len < 0.001) return null;

  const geo  = new THREE.BoxGeometry(w, h, len);
  const mesh = new THREE.Mesh(geo, mat);

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    dir.clone().normalize()
  );
  mesh.castShadow    = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

// ── Gusset plate at a node position ─────────────────────────
// pos  : THREE.Vector3
// size : plate size (square, metres)
// mat  : THREE.Material
export function gussetMesh(pos, size = 0.18, mat) {
  const geo  = new THREE.BoxGeometry(size, size, 0.022);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.castShadow = true;
  return mesh;
}

// ── Steel I-section profile (ExtrudeGeometry) ───────────────
// width, depth, flangeT, webT in metres
// length along Z axis
export function iSectionMesh(length, width = 0.15, depth = 0.20, flangeT = 0.012, webT = 0.008, mat) {
  const hw = width / 2, hd = depth / 2;
  const shape = new THREE.Shape();
  // Build I-section outline clockwise
  shape.moveTo(-hw,  hd);
  shape.lineTo( hw,  hd);
  shape.lineTo( hw,  hd - flangeT);
  shape.lineTo( webT / 2, hd - flangeT);
  shape.lineTo( webT / 2, -hd + flangeT);
  shape.lineTo( hw, -hd + flangeT);
  shape.lineTo( hw, -hd);
  shape.lineTo(-hw, -hd);
  shape.lineTo(-hw, -hd + flangeT);
  shape.lineTo(-webT / 2, -hd + flangeT);
  shape.lineTo(-webT / 2,  hd - flangeT);
  shape.lineTo(-hw,  hd - flangeT);
  shape.closePath();

  const extrudeSettings = { depth: length, bevelEnabled: false };
  const geo  = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x  = -Math.PI / 2; // lay flat along Z
  mesh.castShadow   = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Hollow rectangular section (SHS/RHS) ─────────────────────
export function rhsSectionMesh(length, width = 0.12, depth = 0.15, thickness = 0.006, mat) {
  const hw = width / 2, hd = depth / 2;
  const iw = hw - thickness, id = hd - thickness;
  const shape = new THREE.Shape();
  shape.moveTo(-hw,  hd);
  shape.lineTo( hw,  hd);
  shape.lineTo( hw, -hd);
  shape.lineTo(-hw, -hd);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-iw,  id);
  hole.lineTo( iw,  id);
  hole.lineTo( iw, -id);
  hole.lineTo(-iw, -id);
  hole.closePath();
  shape.holes.push(hole);

  const geo  = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x  = -Math.PI / 2;
  mesh.castShadow   = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Align a mesh along an arbitrary direction vector ─────────
// Applies position (midpoint) and quaternion rotation in-place
export function alignMeshAlongVector(mesh, start, end) {
  const dir = new THREE.Vector3().subVectors(end, start).normalize();
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
}

// ── Compute 3D node positions from 2D topology ───────────────
// nodes2D: { [key]: [x, y] }  (truss elevation coords)
// zOffset: position along Z axis (bay position)
// originX: x-shift so truss is centred (typically -span/2)
// returns: { [key]: THREE.Vector3 }
export function nodes2Dto3D(nodes2D, span, zOffset = 0) {
  const originX = -span / 2;
  const result  = {};
  Object.entries(nodes2D).forEach(([key, [x, y]]) => {
    result[key] = new THREE.Vector3(originX + x, y, zOffset);
  });
  return result;
}

// ── Create a tube gutter along an array of points ────────────
export function gutterTube(points3D, radius = 0.055, mat) {
  const curve  = new THREE.CatmullRomCurve3(points3D);
  const geo    = new THREE.TubeGeometry(curve, points3D.length * 4, radius, 8, false);
  const mesh   = new THREE.Mesh(geo, mat);
  mesh.castShadow   = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ── Down-pipe cylinder ───────────────────────────────────────
export function downpipeMesh(position, height = 3.2, radius = 0.04, mat) {
  const geo  = new THREE.CylinderGeometry(radius, radius, height, 8);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position.x, position.y + height / 2, position.z);
  mesh.castShadow = true;
  return mesh;
}

// ── Base plate (fixed portal) ────────────────────────────────
export function basePlateMesh(position, size = 0.35, thickness = 0.04, mat) {
  const geo  = new THREE.BoxGeometry(size, thickness, size);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.position.y += thickness / 2;
  return mesh;
}

// ── Pin base (ball joint for pinned portal) ──────────────────
export function pinMesh(position, radius = 0.08, mat) {
  const geo  = new THREE.SphereGeometry(radius, 8, 6);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.position.y += radius;
  return mesh;
}
