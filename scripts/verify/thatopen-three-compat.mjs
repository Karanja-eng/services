// Verify That Open Components against the installed three version.
//
// `@thatopen/components` declares `three >= 0.175` as a peer, but the repository
// must keep `three 0.172.0`: that is what MLightCAD 1.7.5 (`three ^0.172.0`) and
// React Three Fiber 9.4 are verified against, and the bundle may only contain one
// three instance. Instead of trusting either range, this script asserts that every
// symbol That Open actually imports from `three` exists in the installed build, and
// then exercises the code paths most likely to break across a version gap.
//
// Run with: npm run verify:thatopen-three   (exit code 0 means compatible)
import * as THREE from 'three';

const componentsSymbols = [
  'BackSide', 'Box3', 'BoxGeometry', 'BufferAttribute', 'BufferGeometry', 'Controls',
  'CylinderGeometry', 'DoubleSide', 'Euler', 'Float32BufferAttribute', 'FrontSide',
  'Line', 'Line3', 'LineBasicMaterial', 'Matrix4', 'Mesh', 'MeshBasicMaterial',
  'Object3D', 'OctahedronGeometry', 'Plane', 'PlaneGeometry', 'Quaternion', 'Ray',
  'Raycaster', 'Sphere', 'SphereGeometry', 'TorusGeometry', 'Triangle', 'Vector2',
  'Vector3',
];

const fragmentsSymbols = [
  'BackSide', 'Box3', 'BufferAttribute', 'DoubleSide', 'Float32BufferAttribute',
  'FrontSide', 'InstancedBufferGeometry', 'InstancedInterleavedBuffer',
  'InterleavedBufferAttribute', 'Line3', 'MathUtils', 'Matrix4', 'Mesh', 'Plane',
  'Ray', 'ShaderLib', 'ShaderMaterial', 'Sphere', 'Triangle', 'UniformsLib',
  'UniformsUtils', 'Vector2', 'Vector3', 'Vector4', 'WireframeGeometry',
];

function check(label, names) {
  const missing = names.filter((n) => THREE[n] === undefined);
  console.log(`${label}: required=${names.length} missing=${missing.length}`);
  if (missing.length) console.log(`  MISSING: ${missing.join(', ')}`);
  return missing;
}

console.log(`three version: ${THREE.REVISION}`);

// Behavioural checks for the pieces most likely to have changed between r172
// and r182, because a missing symbol is not the only way a version can break.
const m1 = check('@thatopen/components 3.3.3', componentsSymbols);
const m2 = check('@thatopen/fragments 3.3.3', fragmentsSymbols);

let behaviourOk = true;
try {
  // InstancedBufferGeometry + InstancedInterleavedBuffer are what the fragment
  // batcher relies on; exercise them together.
  const geo = new THREE.InstancedBufferGeometry();
  const interleaved = new THREE.InstancedInterleavedBuffer(new Float32Array(16), 4, 1);
  geo.setAttribute('a', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  const box = new THREE.Box3().setFromObject(mesh);
  console.log(`InstancedBufferGeometry path: ok (box3 empty=${box.isEmpty()})`);

  // ShaderLib/UniformsLib presence is what fragments uses to clone materials.
  const cloned = THREE.UniformsUtils.clone(THREE.UniformsLib.lights || {});
  console.log(`UniformsLib.lights clone: ok (keys=${Object.keys(cloned).length})`);

  // Controls base class must be constructable-derived for camera-controls to hook.
  console.log(`Controls is class: ${typeof THREE.Controls === 'function'}`);
} catch (error) {
  behaviourOk = false;
  console.log(`behaviour probe FAILED: ${error.message}`);
}

const allPresent = m1.length === 0 && m2.length === 0;
console.log(`RESULT: symbol-compatible=${allPresent} behaviour-ok=${behaviourOk}`);
process.exit(allPresent && behaviourOk ? 0 : 1);
