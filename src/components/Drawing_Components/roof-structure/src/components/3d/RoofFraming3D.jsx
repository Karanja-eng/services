// ─────────────────────────────────────────────────────────────
//  RoofFraming3D.jsx
//  React Three Fiber component for traditional cut-rafter roofs.
//  Includes: ridge beam, common rafters, purlins, collar ties,
//            hip rafters, valley rafters, jack rafters.
//
//  Props:
//    pitch          number  (degrees, 10–55)
//    footprint      { w, d }  (width × depth in metres)
//    rafterSpacing  number  (metres, e.g. 0.4 or 0.6)
//    purlinSpacing  number  (fractional rise position, e.g. 0.33 for 3 lines)
//    material       'timber'|'steel'
//    type           'gable'|'hip'|'valley'|'mono'  (roof form)
//    showRafters    bool
//    showPurlins    bool
//    showCollar     bool
//    showRidge      bool
//    showHip        bool
//    showBracing    bool
//    position       [x,y,z]
//
//  Usage:
//    <RoofFraming3D pitch={30} footprint={{ w:8, d:6 }}
//                   rafterSpacing={0.6} material="timber"
//                   type="hip" showHip />
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { DEG, SECTION_SIZES } from '../constants/roofStructureTypes.js';
import { memberMesh, disposeGroup } from '../utils/geometryUtils.js';
import { createMaterials } from '../utils/materialFactory.js';

// Re-export the path for tree-shaking
export { default as RoofTruss3D } from './RoofTruss3D.jsx';

export default function RoofFraming3D({
  pitch         = 30,
  footprint     = { w: 8, d: 10 },
  rafterSpacing = 0.6,
  material      = 'timber',
  type          = 'gable',
  showRafters   = true,
  showPurlins   = true,
  showCollar    = true,
  showRidge     = true,
  showHip       = true,
  showBracing   = true,
  position      = [0, 0, 0],
}) {
  const groupRef = useRef();
  const mats = useMemo(() => createMaterials(material), [material]);
  const sz   = useMemo(() => SECTION_SIZES[material],   [material]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    disposeGroup(group);

    const { w, d } = footprint;
    const halfW  = w / 2;
    const halfD  = d / 2;
    const rise   = halfW * Math.tan(pitch * DEG);
    const slopeVec = new THREE.Vector3(0, rise, 0)
      .sub(new THREE.Vector3(-halfW, 0, 0))
      .normalize();

    // ── Ridge beam ────────────────────────────────────────────
    if (showRidge) {
      const ridgeZ0 = type === 'hip' ? -halfD + halfW * (halfD / halfW > 1 ? 0 : halfW) : -halfD;
      const ridgeZ1 = -ridgeZ0;
      const rs = new THREE.Vector3(0, rise, ridgeZ0);
      const re = new THREE.Vector3(0, rise, ridgeZ1);
      const rm = memberMesh(rs, re, sz.ridge_w, sz.ridge_h, mats.ridge);
      if (rm) group.add(rm);
    }

    // ── Common rafters ────────────────────────────────────────
    if (showRafters) {
      const numR = Math.floor(d / rafterSpacing) + 2;
      for (let r = 0; r <= numR; r++) {
        const rz = -halfD + r * rafterSpacing;
        if (rz > halfD + 0.01) break;

        // Left slope: eave (-halfW,0) → ridge (0,rise)
        const lm = memberMesh(
          new THREE.Vector3(-halfW, 0, rz),
          new THREE.Vector3(0, rise, rz),
          sz.rafter_w, sz.rafter_h, mats.rafter
        );
        if (lm) group.add(lm);

        // Right slope: ridge (0,rise) → eave (+halfW,0)
        const rm2 = memberMesh(
          new THREE.Vector3(0, rise, rz),
          new THREE.Vector3(halfW, 0, rz),
          sz.rafter_w, sz.rafter_h, mats.rafter
        );
        if (rm2) group.add(rm2);
      }
    }

    // ── Purlins ───────────────────────────────────────────────
    if (showPurlins) {
      // 3 purlin lines at 25%, 55%, 80% of rise height
      [0.25, 0.55, 0.80].forEach(frac => {
        const py      = rise * frac;
        // x-position on slope: x = halfW - (halfW * frac)  [linear interpolation]
        const pHalfW  = halfW * (1 - frac);
        const purlinZ0 = -halfD;
        const purlinZ1 =  halfD;

        [-pHalfW, pHalfW].forEach(px => {
          const m = memberMesh(
            new THREE.Vector3(px, py, purlinZ0),
            new THREE.Vector3(px, py, purlinZ1),
            sz.purlin_w, sz.purlin_h, mats.purlin
          );
          if (m) group.add(m);
        });
      });
    }

    // ── Collar ties ───────────────────────────────────────────
    if (showCollar) {
      const colH     = rise * 0.55;
      const colHalfW = halfW * (1 - colH / rise);
      const numR     = Math.floor(d / rafterSpacing) + 2;

      for (let r = 0; r <= numR; r++) {
        const rz = -halfD + r * rafterSpacing;
        if (rz > halfD + 0.01) break;
        const cm = memberMesh(
          new THREE.Vector3(-colHalfW, colH, rz),
          new THREE.Vector3( colHalfW, colH, rz),
          sz.collar_w, sz.collar_h, mats.collar
        );
        if (cm) group.add(cm);
      }
    }

    // ── Hip rafters (hip roof only) ───────────────────────────
    if (showHip && type === 'hip') {
      const hipMat = mats.hip;
      // 4 corner hip rafters from ridge ends to eave corners
      const ridgeHL = Math.max(0, halfD - halfW);

      const ridgeEnds = [
        new THREE.Vector3(0, rise, -ridgeHL),
        new THREE.Vector3(0, rise,  ridgeHL),
      ];

      const eaveCorners = [
        new THREE.Vector3(-halfW, 0, -halfD),
        new THREE.Vector3( halfW, 0, -halfD),
        new THREE.Vector3(-halfW, 0,  halfD),
        new THREE.Vector3( halfW, 0,  halfD),
      ];

      // Pair each eave corner to nearest ridge end
      eaveCorners.forEach(corner => {
        const nearRidge = corner.z < 0 ? ridgeEnds[0] : ridgeEnds[1];
        const hm = memberMesh(corner, nearRidge, sz.rafter_w + 0.02, sz.rafter_h + 0.04, hipMat);
        if (hm) group.add(hm);
      });

      // Jack rafters filling hip triangles
      const jackSpacing = rafterSpacing;
      [[-1, ridgeEnds[0], -halfD], [1, ridgeEnds[1], halfD]].forEach(([sign, ridgeEnd, endZ]) => {
        for (let j = 1; j * jackSpacing < halfW; j++) {
          const jz  = endZ + sign * j * jackSpacing;
          const jx  = j * jackSpacing;   // distance inset from corner
          const jRise = (halfW - jx) / halfW * rise;

          // Left jack
          const ljm = memberMesh(
            new THREE.Vector3(-halfW + jx, 0, jz),
            new THREE.Vector3(0, jRise, jz),
            sz.rafter_w, sz.rafter_h, mats.rafter
          );
          if (ljm) group.add(ljm);

          // Right jack
          const rjm = memberMesh(
            new THREE.Vector3(halfW - jx, 0, jz),
            new THREE.Vector3(0, jRise, jz),
            sz.rafter_w, sz.rafter_h, mats.rafter
          );
          if (rjm) group.add(rjm);
        }
      });
    }

    // ── Valley rafters ────────────────────────────────────────
    if (type === 'valley') {
      const valMat = mats.valley;
      [-1, 1].forEach(side => {
        const vm = memberMesh(
          new THREE.Vector3(side * halfW, 0, 0),
          new THREE.Vector3(0, rise * 0.6, 0),
          sz.rafter_w + 0.02, sz.rafter_h + 0.04, valMat
        );
        if (vm) group.add(vm);
      });
    }

    // ── Mono slope (single pitch) ─────────────────────────────
    if (type === 'mono' && showRafters) {
      const monoRise = w * Math.tan(pitch * DEG);
      const numR     = Math.floor(d / rafterSpacing) + 2;
      disposeGroup(group); // Clear standard gable rafters

      // Ridge beam at high side
      if (showRidge) {
        const rm = memberMesh(
          new THREE.Vector3(-halfW, monoRise, -halfD),
          new THREE.Vector3(-halfW, monoRise,  halfD),
          sz.ridge_w, sz.ridge_h, mats.ridge
        );
        if (rm) group.add(rm);
      }

      for (let r = 0; r <= numR; r++) {
        const rz = -halfD + r * rafterSpacing;
        if (rz > halfD + 0.01) break;
        const m = memberMesh(
          new THREE.Vector3(-halfW, monoRise, rz),
          new THREE.Vector3( halfW, 0, rz),
          sz.rafter_w, sz.rafter_h, mats.rafter
        );
        if (m) group.add(m);
      }
    }

    // ── Diagonal wind bracing in roof plane ───────────────────
    if (showBracing) {
      const bm = memberMesh(
        new THREE.Vector3(-halfW, 0, -halfD),
        new THREE.Vector3(0, rise,  halfD),
        sz.brace_w, sz.brace_h, mats.brace
      );
      if (bm) group.add(bm);
    }

    return () => disposeGroup(group);
  }, [pitch, footprint, rafterSpacing, material, type,
      showRafters, showPurlins, showCollar, showRidge,
      showHip, showBracing, mats, sz]);

  return <group ref={groupRef} position={position} />;
}
