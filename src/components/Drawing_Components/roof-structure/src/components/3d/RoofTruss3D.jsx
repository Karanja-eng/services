// ─────────────────────────────────────────────────────────────
//  RoofTruss3D.jsx
//  React Three Fiber component for 3D roof truss arrays.
//
//  Props:
//    type        'king'|'queen'|'howe'|'pratt'|'fan'|'attic'|'mono'
//    span        number (metres)
//    pitch       number (degrees)
//    spacing     number (metres centre-to-centre)
//    bays        number (truss count)
//    material    'timber'|'steel'
//    showChords  bool
//    showWebs    bool
//    showPurlins bool
//    showCollar  bool
//    showBracing bool
//    showGussets bool
//    position    [x,y,z]  (group offset)
//
//  Usage:
//    <RoofTruss3D type="queen" span={9} pitch={35} spacing={0.6}
//                 bays={6} material="timber" showPurlins showCollar />
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react';
import { useThree }  from '@react-three/fiber';
import * as THREE    from 'three';

import { trussTopology, SECTION_SIZES, DEG } from '../../constants/roofStructureTypes.js';
import { memberMesh, gussetMesh, nodes2Dto3D, disposeGroup } from '../../utils/geometryUtils.js';
import { createMaterials } from '../../utils/materialFactory.js';

export default function RoofTruss3D({
  type        = 'king',
  span        = 8,
  pitch       = 30,
  spacing     = 0.6,
  bays        = 5,
  material    = 'timber',
  showChords  = true,
  showWebs    = true,
  showPurlins = true,
  showCollar  = true,
  showBracing = true,
  showGussets = true,
  position    = [0, 0, 0],
}) {
  const groupRef = useRef();

  const mats = useMemo(() => createMaterials(material), [material]);
  const sz   = useMemo(() => SECTION_SIZES[material],   [material]);

  // Rebuild geometry whenever props change
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    disposeGroup(group);

    const { nodes: nodes2D, members, supports } = trussTopology(type, span, pitch);
    const totalLen = (bays - 1) * spacing;
    const rise     = (span / 2) * Math.tan(pitch * DEG);

    // ── Per-bay trusses ───────────────────────────────────────
    for (let b = 0; b < bays; b++) {
      const bz      = -totalLen / 2 + b * spacing;
      const nodes3D = nodes2Dto3D(nodes2D, span, bz);
      const bayGroup = new THREE.Group();

      members.forEach(([aKey, bKey, mType]) => {
        if (mType === 'chord' && !showChords) return;
        if (mType === 'web'   && !showWebs)   return;

        const matMesh = mType === 'chord' ? mats.chord : mats.web;
        const w       = mType === 'chord' ? sz.chord_w : sz.web_w;
        const h       = mType === 'chord' ? sz.chord_h : sz.web_h;
        const mesh    = memberMesh(nodes3D[aKey], nodes3D[bKey], w, h, matMesh);
        if (mesh) bayGroup.add(mesh);
      });

      // Gusset plates at each node
      if (showGussets) {
        Object.values(nodes3D).forEach(pos => {
          const g = gussetMesh(pos, sz.gusset_s, mats.gusset);
          g.rotation.y = Math.PI / 2; // face along Z (towards viewer)
          bayGroup.add(g);
        });
      }

      group.add(bayGroup);
    }

    // ── Purlins (continuous along Z through all bays) ─────────
    if (showPurlins && bays > 1) {
      const purlinZ0 = -totalLen / 2;
      const purlinZ1 =  totalLen / 2;

      // Collect top-chord node positions (y > 0, not apex)
      const purlinNodeKeys = Object.entries(nodes2D)
        .filter(([, [, y]]) => y > 0.01 && y < rise - 0.01)
        .map(([key]) => key);

      // Apex node
      const apexKey = Object.entries(nodes2D)
        .reduce((best, [k, [, y]]) => (y > best[1] ? [k, y] : best), ['', -Infinity])[0];

      const allPurlinKeys = [...purlinNodeKeys, apexKey];

      allPurlinKeys.forEach(key => {
        const [nx, ny] = nodes2D[key];
        const x = nx - span / 2;
        const s3 = new THREE.Vector3(x, ny, purlinZ0);
        const e3 = new THREE.Vector3(x, ny, purlinZ1);
        const pw  = key === apexKey ? sz.ridge_w : sz.purlin_w;
        const ph  = key === apexKey ? sz.ridge_h : sz.purlin_h;
        const pMat = key === apexKey ? mats.ridge : mats.purlin;
        const m  = memberMesh(s3, e3, pw, ph, pMat);
        if (m) group.add(m);
      });

      // Eave purlins at chord base
      [-span / 2, span / 2].forEach(ex => {
        const s3 = new THREE.Vector3(ex, 0, purlinZ0);
        const e3 = new THREE.Vector3(ex, 0, purlinZ1);
        const m  = memberMesh(s3, e3, sz.purlin_w, sz.purlin_h, mats.purlin);
        if (m) group.add(m);
      });
    }

    // ── Collar ties (one per bay) ─────────────────────────────
    if (showCollar && type !== 'attic') {
      const colH      = rise * 0.55;
      const ratio     = colH / rise;
      const colHalfW  = (1 - ratio) * span / 2;

      for (let b = 0; b < bays; b++) {
        const bz = -totalLen / 2 + b * spacing;
        const s3 = new THREE.Vector3(-colHalfW, colH, bz);
        const e3 = new THREE.Vector3( colHalfW, colH, bz);
        const m  = memberMesh(s3, e3, sz.collar_w, sz.collar_h, mats.collar);
        if (m) group.add(m);
      }
    }

    // ── Wind bracing (diagonal in roof plane) ─────────────────
    if (showBracing && bays > 1) {
      // Apex bracing — from apex of bay 0 to eave of bay 1
      const [apexKey2D, [apexX, apexY]] = Object.entries(nodes2D)
        .reduce((best, entry) => entry[1][1] > best[1][1] ? entry : best);

      const ax = apexX - span / 2;
      const z0 = -totalLen / 2;
      const z1 = z0 + spacing;

      const braceStart = new THREE.Vector3(ax, apexY, z0);
      const braceEnd   = new THREE.Vector3(-span / 2, 0, z1);
      const bm = memberMesh(braceStart, braceEnd, sz.brace_w, sz.brace_h, mats.brace);
      if (bm) group.add(bm);

      // Counter brace
      const bm2 = memberMesh(
        new THREE.Vector3(ax, apexY, z0),
        new THREE.Vector3(span / 2, 0, z1),
        sz.brace_w, sz.brace_h, mats.brace
      );
      if (bm2) group.add(bm2);
    }

    return () => disposeGroup(group);
  }, [type, span, pitch, spacing, bays, material,
      showChords, showWebs, showPurlins, showCollar,
      showBracing, showGussets, mats, sz]);

  return (
    <group ref={groupRef} position={position} />
  );
}
