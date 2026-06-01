// Slab3D.jsx — React Three Fiber 3D slab geometry
// Install: npm install three @react-three/fiber @react-three/drei

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SLAB_TYPES, MATERIALS } from './slabTypes';
import { useSlabStore } from './slabStore';

// ─── Material helpers ─────────────────────────────────────────────────────────

function useSlabMaterial(matKey = 'concrete', color) {
  return useMemo(() => {
    const m = MATERIALS[matKey] || MATERIALS.concrete;
    return new THREE.MeshStandardMaterial({
      color: color || m.color,
      roughness: m.roughness,
      metalness: m.metalness,
    });
  }, [matKey, color]);
}

// ─── Footprint → ExtrudeGeometry ─────────────────────────────────────────────

function footprintToShape(footprint) {
  const shape = new THREE.Shape();
  footprint.forEach((pt, i) => {
    const x = pt.x / 1000;   // convert mm → m
    const y = pt.y / 1000;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

// ─── Flat / Flat Plate / PT / Raft ───────────────────────────────────────────

function FlatSlab({ footprint, thickness, material, color }) {
  const mat = useSlabMaterial(material, color);
  const geometry = useMemo(() => {
    const shape = footprintToShape(footprint);
    return new THREE.ExtrudeGeometry(shape, {
      depth: thickness / 1000,
      bevelEnabled: false,
    });
  }, [footprint, thickness]);

  return (
    <mesh geometry={geometry} material={mat} position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
  );
}

// ─── Post-Tensioned tendons ───────────────────────────────────────────────────

function PTTendons({ footprint, thickness }) {
  const bbox = useMemo(() => {
    const xs = footprint.map(p => p.x / 1000);
    const ys = footprint.map(p => p.y / 1000);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [footprint]);

  const tendonColor = '#F39C12';
  const z = thickness / 1000 * 0.25; // low eccentricity position

  const tendonsX = useMemo(() => {
    const lines = [];
    for (let x = bbox.minX + 0.8; x < bbox.maxX; x += 0.8) {
      const pts = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = bbox.minY + (bbox.maxY - bbox.minY) * t;
        // Parabolic drape: high at ends, low at midspan
        const zOffset = 4 * z * t * (1 - t);
        pts.push(new THREE.Vector3(x, zOffset, y));
      }
      lines.push(pts);
    }
    return lines;
  }, [bbox, z]);

  return (
    <>
      {tendonsX.map((pts, i) => (
        <Line key={i} points={pts} color={tendonColor} lineWidth={1.5} />
      ))}
    </>
  );
}

// ─── One-way ribbed slab ──────────────────────────────────────────────────────

function RibbedSlab({ footprint, thickness, ribSpacing, ribWidth, material, color }) {
  const mat = useSlabMaterial(material, color);
  const infillMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1E2130', roughness: 0.95 }), []);

  const bbox = useMemo(() => {
    const xs = footprint.map(p => p.x / 1000);
    const ys = footprint.map(p => p.y / 1000);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [footprint]);

  const toppingH    = (thickness * 0.25) / 1000;
  const ribH        = (thickness * 0.75) / 1000;
  const ribWm       = ribWidth / 1000;
  const ribSpm      = ribSpacing / 1000;
  const spanX       = bbox.maxX - bbox.minX;
  const spanY       = bbox.maxY - bbox.minY;

  // Topping slab
  const toppingGeo = useMemo(() => {
    const shape = footprintToShape(footprint);
    return new THREE.ExtrudeGeometry(shape, { depth: toppingH, bevelEnabled: false });
  }, [footprint, toppingH]);

  // Ribs + infill blocks
  const ribs = useMemo(() => {
    const result = [];
    for (let x = bbox.minX; x <= bbox.maxX; x += ribSpm) {
      result.push({ type: 'rib', x, z: bbox.minY });
    }
    return result;
  }, [bbox, ribSpm]);

  const infillBlocks = useMemo(() => {
    const result = [];
    for (let x = bbox.minX; x < bbox.maxX - ribSpm + ribWm; x += ribSpm) {
      result.push({ x: x + ribWm, width: ribSpm - ribWm });
    }
    return result;
  }, [bbox, ribSpm, ribWm]);

  return (
    <group>
      {/* Topping */}
      <mesh geometry={toppingGeo} material={mat} position={[0, ribH, 0]}
        rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      {/* Ribs */}
      {ribs.map((r, i) => (
        <mesh key={i} material={mat} castShadow receiveShadow>
          <boxGeometry args={[ribWm, ribH, spanY]} />
          <primitive object={mat} attach="material" />
          {/* position: x centred on rib, y half ribH above zero, z centred */}
        </mesh>
      ))}
      {/* Simplified rib array via instanced mesh */}
      <RibArray
        ribPositions={ribs.map(r => r.x + ribWm / 2)}
        ribWidth={ribWm}
        ribHeight={ribH}
        spanY={spanY}
        minZ={bbox.minY + spanY / 2}
        mat={mat}
      />
      {/* Infill blocks */}
      {infillBlocks.map((b, i) => (
        <mesh key={i} material={infillMat} position={[b.x + b.width/2, ribH * 0.4, bbox.minY + spanY/2]}>
          <boxGeometry args={[b.width - 0.01, ribH * 0.8, spanY - 0.01]} />
        </mesh>
      ))}
    </group>
  );
}

function RibArray({ ribPositions, ribWidth, ribHeight, spanY, minZ, mat }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = ribPositions.length;
  const geo = useMemo(() => new THREE.BoxGeometry(ribWidth, ribHeight, spanY), [ribWidth, ribHeight, spanY]);

  useMemo(() => {
    ribPositions.forEach((x, i) => {
      dummy.position.set(x, ribHeight / 2, minZ);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [ribPositions, ribHeight, minZ, dummy]);

  return (
    <instancedMesh ref={mesh} args={[geo, mat, count]}>
    </instancedMesh>
  );
}

// ─── Waffle slab ─────────────────────────────────────────────────────────────

function WaffleSlab({ footprint, thickness, ribSpacing, ribWidth, cofferSize, material, color }) {
  const mat = useSlabMaterial(material, color);
  const cofferMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0D0F1A', roughness: 1.0,
  }), []);

  const bbox = useMemo(() => {
    const xs = footprint.map(p => p.x / 1000);
    const ys = footprint.map(p => p.y / 1000);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [footprint]);

  const toppingH = (thickness * 0.22) / 1000;
  const ribH     = (thickness * 0.78) / 1000;
  const ribWm    = ribWidth / 1000;
  const csm      = (cofferSize || 600) / 1000;
  const spanX    = bbox.maxX - bbox.minX;
  const spanY    = bbox.maxY - bbox.minY;

  const toppingGeo = useMemo(() => {
    const shape = footprintToShape(footprint);
    return new THREE.ExtrudeGeometry(shape, { depth: toppingH, bevelEnabled: false });
  }, [footprint, toppingH]);

  // X ribs (running along Y axis)
  const xRibs = useMemo(() => {
    const positions = [];
    for (let x = bbox.minX; x <= bbox.maxX; x += csm) positions.push(x);
    return positions;
  }, [bbox, csm]);

  // Y ribs (running along X axis)
  const yRibs = useMemo(() => {
    const positions = [];
    for (let y = bbox.minY; y <= bbox.maxY; y += csm) positions.push(y);
    return positions;
  }, [bbox, csm]);

  // Coffers
  const coffers = useMemo(() => {
    const arr = [];
    for (let x = bbox.minX; x < bbox.maxX - csm + ribWm; x += csm) {
      for (let y = bbox.minY; y < bbox.maxY - csm + ribWm; y += csm) {
        const cw = csm - ribWm;
        if (cw > 0.05) arr.push({ x: x + ribWm + cw/2, y: y + ribWm + cw/2, size: cw });
      }
    }
    return arr;
  }, [bbox, csm, ribWm]);

  const xRibGeo = useMemo(() => new THREE.BoxGeometry(ribWm, ribH, spanY), [ribWm, ribH, spanY]);
  const yRibGeo = useMemo(() => new THREE.BoxGeometry(spanX, ribH, ribWm), [spanX, ribH, ribWm]);

  return (
    <group>
      {/* Topping */}
      <mesh geometry={toppingGeo} material={mat} position={[0, ribH, 0]}
        rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      {/* X ribs */}
      {xRibs.map((x, i) => (
        <mesh key={`xr-${i}`} material={mat} position={[x + ribWm/2, ribH/2, bbox.minY + spanY/2]} castShadow>
          <primitive object={xRibGeo} attach="geometry" />
        </mesh>
      ))}
      {/* Y ribs */}
      {yRibs.map((y, i) => (
        <mesh key={`yr-${i}`} material={mat} position={[bbox.minX + spanX/2, ribH/2, y + ribWm/2]} castShadow>
          <primitive object={yRibGeo} attach="geometry" />
        </mesh>
      ))}
      {/* Coffers */}
      {coffers.map((c, i) => (
        <mesh key={`coffer-${i}`} material={cofferMat}
          position={[c.x, ribH * 0.35, c.y]}>
          <boxGeometry args={[c.size - 0.02, ribH * 0.7, c.size - 0.02]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Hollow-core precast ──────────────────────────────────────────────────────

function HollowCoreSlab({ footprint, thickness, material }) {
  const mat = useSlabMaterial(material);
  const voidMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#090B10' }), []);

  const bbox = useMemo(() => {
    const xs = footprint.map(p => p.x / 1000);
    const ys = footprint.map(p => p.y / 1000);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [footprint]);

  const th = thickness / 1000;
  const voidR = th * 0.32;
  const voidSpacing = th * 1.15;
  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;

  const voidPositions = useMemo(() => {
    const arr = [];
    for (let x = bbox.minX + voidSpacing; x < bbox.maxX - voidSpacing/2; x += voidSpacing) {
      arr.push(x);
    }
    return arr;
  }, [bbox, voidSpacing]);

  const slabGeo = useMemo(() => {
    const shape = footprintToShape(footprint);
    return new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  }, [footprint, th]);

  const voidGeo = useMemo(() =>
    new THREE.CylinderGeometry(voidR, voidR, spanY + 0.1, 16),
  [voidR, spanY]);

  return (
    <group>
      <mesh geometry={slabGeo} material={mat} rotation={[-Math.PI/2, 0, 0]} castShadow receiveShadow />
      {/* Visual void approximation — cylinders running along Y */}
      {voidPositions.map((x, i) => (
        <mesh key={i} material={voidMat}
          position={[x, th / 2, bbox.minY + spanY / 2]}
          rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={voidGeo} attach="geometry" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Composite slab ───────────────────────────────────────────────────────────

function CompositeSlab({ footprint, thickness, material }) {
  const concMat = useSlabMaterial('concrete');
  const steelMat = useSlabMaterial('steel');

  const bbox = useMemo(() => {
    const xs = footprint.map(p => p.x / 1000);
    const ys = footprint.map(p => p.y / 1000);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }, [footprint]);

  const th     = thickness / 1000;
  const deckH  = th * 0.35;
  const concH  = th * 0.65;
  const pitch  = 0.3; // 300mm deck pitch
  const spanX  = bbox.maxX - bbox.minX;
  const spanY  = bbox.maxY - bbox.minY;

  // Concrete topping
  const concGeo = useMemo(() => {
    const shape = footprintToShape(footprint);
    return new THREE.ExtrudeGeometry(shape, { depth: concH, bevelEnabled: false });
  }, [footprint, concH]);

  // Steel deck trapezoids
  const deckSegments = useMemo(() => {
    const segments = [];
    for (let x = bbox.minX; x < bbox.maxX; x += pitch) {
      const shape = new THREE.Shape();
      const h = deckH;
      const w = pitch;
      const flange = w * 0.2;
      shape.moveTo(x, 0);
      shape.lineTo(x + flange, -h);
      shape.lineTo(x + w - flange, -h);
      shape.lineTo(x + w, 0);
      segments.push(shape);
    }
    return segments;
  }, [bbox, pitch, deckH]);

  const deckGeos = useMemo(() =>
    deckSegments.map(s => new THREE.ExtrudeGeometry(s, { depth: spanY, bevelEnabled: false }))
  , [deckSegments, spanY]);

  return (
    <group>
      {/* Concrete topping */}
      <mesh geometry={concGeo} material={concMat} position={[0, deckH, 0]}
        rotation={[-Math.PI/2, 0, 0]} castShadow receiveShadow />
      {/* Steel deck trapezoids */}
      {deckGeos.map((geo, i) => (
        <mesh key={i} geometry={geo} material={steelMat}
          rotation={[-Math.PI/2, 0, 0]}
          position={[0, 0, bbox.minY]} castShadow />
      ))}
    </group>
  );
}

// ─── Column drops ─────────────────────────────────────────────────────────────

function ColumnDrop({ drop, slabThickness }) {
  const mat = useSlabMaterial('concrete', '#B8B0A0');
  const extraH = (drop.extraThickness || 100) / 1000;
  const size   = (drop.size || 2000) / 1000;

  return (
    <mesh material={mat} position={[drop.x / 1000, -extraH / 2, drop.y / 1000]} castShadow>
      <boxGeometry args={[size, extraH, size]} />
    </mesh>
  );
}

// ─── Openings (cutout visual) ─────────────────────────────────────────────────

function SlabOpening({ opening, thickness }) {
  // Visual marker — in production use CSG or clip plane
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#E74C3C', opacity: 0.15, transparent: true, side: THREE.DoubleSide,
  }), []);
  const th = thickness / 1000;
  const w  = opening.width  / 1000;
  const h  = opening.height / 1000;

  return (
    <mesh material={mat}
      position={[opening.x / 1000 + w/2, th / 2, opening.y / 1000]}>
      <boxGeometry args={[w, th + 0.05, h]} />
    </mesh>
  );
}

// ─── Column geometry ──────────────────────────────────────────────────────────

function Columns({ spanX, spanY, slabThickness, nCols = 3, nRows = 3 }) {
  const mat = useSlabMaterial('concrete', '#9AA3C8');
  const colH = 3.6; // 3600mm storey
  const colW = 0.4;
  const stepX = (spanX / 1000) / (nCols - 1);
  const stepY = (spanY / 1000) / (nRows - 1);

  return (
    <>
      {Array.from({ length: nCols }, (_, ci) =>
        Array.from({ length: nRows }, (_, ri) => (
          <mesh key={`col-${ci}-${ri}`} material={mat}
            position={[ci * stepX, -colH / 2, ri * stepY]} castShadow>
            <boxGeometry args={[colW, colH, colW]} />
          </mesh>
        ))
      )}
    </>
  );
}

// ─── Slab dispatcher ─────────────────────────────────────────────────────────

function SlabGeometry({ slab }) {
  const { type, footprint, thickness, ribSpacing, ribWidth, ribHeight,
          cofferSize, drops, openings, material } = slab;

  const common = { footprint, thickness, material };

  const body = (() => {
    switch (type) {
      case 'flat':
      case 'plate':
      case 'raft':
      case 'beam-slab':
        return <FlatSlab {...common} />;
      case 'pt':
        return (
          <>
            <FlatSlab {...common} />
            <PTTendons footprint={footprint} thickness={thickness} />
          </>
        );
      case 'ribbed':
        return <RibbedSlab {...common} ribSpacing={ribSpacing} ribWidth={ribWidth} />;
      case 'waffle':
        return <WaffleSlab {...common} ribSpacing={ribSpacing} ribWidth={ribWidth} cofferSize={cofferSize} />;
      case 'hollow':
        return <HollowCoreSlab {...common} />;
      case 'composite':
        return <CompositeSlab {...common} />;
      default:
        return <FlatSlab {...common} />;
    }
  })();

  return (
    <group position={[0, (slab.level || 0) / 1000, 0]}>
      {body}
      {(drops || []).map((d, i) => (
        <ColumnDrop key={i} drop={d} slabThickness={thickness} />
      ))}
      {(openings || []).map((o, i) => (
        <SlabOpening key={i} opening={o} thickness={thickness} />
      ))}
    </group>
  );
}

// ─── Main Slab3D component ────────────────────────────────────────────────────

/**
 * Standalone usage:
 * <Slab3D
 *   type="waffle"
 *   footprint={[{x,y},...]}
 *   thickness={300}
 *   ribSpacing={750}
 *   ribWidth={150}
 *   cofferSize={600}
 *   drops={[]}
 *   openings={[]}
 *   material="concrete"
 *   ffl={3600}
 *   width={900}
 *   height={600}
 * />
 *
 * Store-connected (no props needed):
 * <Slab3D />
 */
export function Slab3D({
  type, footprint, thickness, ribSpacing, ribWidth, ribHeight,
  cofferSize, waffleGrid, drops, openings, material, ffl,
  width = 900, height = 600,
}) {
  const { slabs, spanX, spanY } = useSlabStore();

  const standaloneMode = !!footprint;
  const displaySlabs = standaloneMode
    ? [{ id: 'standalone', type, footprint, thickness, ribSpacing, ribWidth,
         ribHeight, cofferSize, drops: drops || [], openings: openings || [],
         material: material || 'concrete', level: ffl || 0 }]
    : slabs;

  const bgColor = '#0A0C14';

  return (
    <div style={{ width, height, borderRadius: 8, overflow: 'hidden', background: bgColor }}>
      <Canvas
        camera={{ position: [12, 8, 12], fov: 50, near: 0.1, far: 500 }}
        shadows
        gl={{ antialias: true }}
        style={{ background: bgColor }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 30, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-10, 20, -10]} intensity={0.3} color="#7B93FF" />

        {/* Ground grid */}
        <Grid args={[50, 50]} cellSize={1} cellColor="#2D3050"
          sectionSize={3.6} sectionColor="#3D4270"
          position={[spanX / 2000, -0.01, spanY / 2000]}
          rotation={[0, 0, 0]} infiniteGrid />

        {/* Slabs */}
        {displaySlabs.map(slab => (
          <SlabGeometry key={slab.id} slab={slab} />
        ))}

        {/* Columns */}
        {!standaloneMode && (
          <Columns spanX={spanX} spanY={spanY} slabThickness={displaySlabs[0]?.thickness || 250} />
        )}

        <OrbitControls
          makeDefault
          minDistance={3}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2.1}
          target={[spanX / 2000, 0, spanY / 2000]}
        />
      </Canvas>
    </div>
  );
}

export default Slab3D;
