// ─────────────────────────────────────────────────────────────
//  PortalFrame3D.jsx
//  React Three Fiber — steel portal frame component.
//  Includes: columns, rafters, haunches, base plates/pins,
//            ridge plate, purlins, bracing.
//
//  Props:
//    span        number  (metres, eave-to-eave)
//    pitch       number  (degrees)
//    eaveHeight  number  (metres, column height to eave level)
//    spacing     number  (bay spacing, metres)
//    bays        number
//    baseType    'fixed'|'pinned'
//    haunchLen   number  (haunch length from knee, metres, default 1.2)
//    showPurlins bool
//    showBracing bool
//    position    [x,y,z]
//
//  Usage:
//    <PortalFrame3D span={12} pitch={15} eaveHeight={4}
//                   spacing={5} bays={4} baseType="fixed" />
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

import { DEG, SECTION_SIZES } from '../../constants/roofStructureTypes.js';
import {
  memberMesh, disposeGroup,
  basePlateMesh, pinMesh,
} from '../../utils/geometryUtils.js';
import { STEEL_MATS } from '../../utils/materialFactory.js';

export default function PortalFrame3D({
  span       = 12,
  pitch      = 15,
  eaveHeight = 4.0,
  spacing    = 5.0,
  bays       = 4,
  baseType   = 'fixed',
  haunchLen  = 1.2,
  showPurlins = true,
  showBracing = true,
  position   = [0, 0, 0],
}) {
  const groupRef = useRef();
  const sz = SECTION_SIZES.steel;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    disposeGroup(group);

    const totalLen = (bays - 1) * spacing;
    const halfSpan = span / 2;
    const rise     = halfSpan * Math.tan(pitch * DEG);
    const apexH    = eaveHeight + rise;

    // Haunch angle: from knee connection to haunch end
    const haunchRise = haunchLen * Math.tan(pitch * DEG);

    // ── Portal frames (one per bay) ───────────────────────────
    for (let b = 0; b < bays; b++) {
      const bz = -totalLen / 2 + b * spacing;
      const pg = new THREE.Group();
      pg.position.z = bz;

      // Left & right columns
      [-halfSpan, halfSpan].forEach(cx => {
        const sign = cx < 0 ? 1 : -1;

        // Column: from base to eave
        const colStart = new THREE.Vector3(cx, 0, 0);
        const colEnd   = new THREE.Vector3(cx, eaveHeight, 0);
        const cm = memberMesh(colStart, colEnd, sz.column_w, sz.column_h, STEEL_MATS.column);
        if (cm) pg.add(cm);

        // Base connection
        if (baseType === 'fixed') {
          const bp = basePlateMesh(new THREE.Vector3(cx, 0, 0), 0.40, 0.035, STEEL_MATS.gusset);
          pg.add(bp);
          // 4 anchor bolt stubs
          [-0.12, 0.12].forEach(bx => [-0.08, 0.08].forEach(by => {
            const bolt = new THREE.Mesh(
              new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6),
              STEEL_MATS.gusset
            );
            bolt.position.set(cx + bx, 0.06, by);
            pg.add(bolt);
          }));
        } else {
          const pin = pinMesh(new THREE.Vector3(cx, 0, 0), 0.09, STEEL_MATS.gusset);
          pg.add(pin);
        }

        // Knee gusset plate
        const kneeGusset = new THREE.Mesh(
          new THREE.BoxGeometry(0.30, 0.30, 0.016),
          STEEL_MATS.gusset
        );
        kneeGusset.position.set(cx, eaveHeight, 0);
        pg.add(kneeGusset);

        // Haunch: tapered section from knee to haunch point on rafter
        const kneePos   = new THREE.Vector3(cx, eaveHeight, 0);
        const haunchEnd = new THREE.Vector3(cx + sign * haunchLen, eaveHeight + haunchRise, 0);
        const hm = memberMesh(kneePos, haunchEnd, sz.column_w, sz.column_h * 1.4, STEEL_MATS.haunch);
        if (hm) pg.add(hm);

        // Rafter: from haunch end to apex
        const rafterStart = haunchEnd;
        const rafterEnd   = new THREE.Vector3(0, apexH, 0);
        const rm = memberMesh(rafterStart, rafterEnd, sz.chord_w, sz.chord_h, STEEL_MATS.chord);
        if (rm) pg.add(rm);
      });

      // Ridge plate
      const ridgePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.25, 0.016),
        STEEL_MATS.gusset
      );
      ridgePlate.position.set(0, apexH, 0);
      pg.add(ridgePlate);

      group.add(pg);
    }

    // ── Purlins (along Z through all frames) ──────────────────
    if (showPurlins && bays > 1) {
      const purlinZ0 = -totalLen / 2;
      const purlinZ1 =  totalLen / 2;

      // Purlins at ~30%, 60%, 85% of rafter height from eave
      [0.30, 0.60, 0.85].forEach(frac => {
        const px   = halfSpan - halfSpan * frac;
        const py   = eaveHeight + rise * frac;
        [-px, px].forEach(side => {
          const pm = memberMesh(
            new THREE.Vector3(side, py, purlinZ0),
            new THREE.Vector3(side, py, purlinZ1),
            sz.purlin_w, sz.purlin_h, STEEL_MATS.purlin
          );
          if (pm) group.add(pm);
        });
      });

      // Eave purlins
      [-halfSpan, halfSpan].forEach(ex => {
        const em = memberMesh(
          new THREE.Vector3(ex, eaveHeight, purlinZ0),
          new THREE.Vector3(ex, eaveHeight, purlinZ1),
          sz.purlin_w, sz.purlin_h, STEEL_MATS.purlin
        );
        if (em) group.add(em);
      });
    }

    // ── Flange bracing / sway bracing ────────────────────────
    if (showBracing && bays > 1) {
      const bz0 = -totalLen / 2;
      const bz1 = bz0 + spacing;

      // Column sway bracing (X-brace between first two bays)
      [-halfSpan, halfSpan].forEach(cx => {
        const b1 = memberMesh(
          new THREE.Vector3(cx, 0, bz0),
          new THREE.Vector3(cx, eaveHeight, bz1),
          sz.brace_w, sz.brace_h, STEEL_MATS.brace
        );
        if (b1) group.add(b1);

        const b2 = memberMesh(
          new THREE.Vector3(cx, eaveHeight, bz0),
          new THREE.Vector3(cx, 0, bz1),
          sz.brace_w, sz.brace_h, STEEL_MATS.brace
        );
        if (b2) group.add(b2);
      });

      // Roof plane bracing
      const rb = memberMesh(
        new THREE.Vector3(-halfSpan, eaveHeight, bz0),
        new THREE.Vector3(0, apexH, bz1),
        sz.brace_w, sz.brace_h, STEEL_MATS.brace
      );
      if (rb) group.add(rb);
    }

    return () => disposeGroup(group);
  }, [span, pitch, eaveHeight, spacing, bays, baseType,
      haunchLen, showPurlins, showBracing, sz]);

  return <group ref={groupRef} position={position} />;
}
