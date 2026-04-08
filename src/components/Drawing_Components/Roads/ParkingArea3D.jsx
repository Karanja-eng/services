import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

export function ParkingArea3D({ element }) {
  const {
    origin = [0, 0],
    width = 20,
    depth = 12,
    bayAngle = 90,
    bayWidth = 2.5,
    bayDepth = 5.0,
    aisleWidth = 6.0,
    rows = 1,
    material = 'asphalt',
  } = element;

  const [ox, oz] = origin;

  const surfaceColor = material === 'asphalt' ? '#1c1c1c' : '#b0a898';

  // Compute bays
  const bays = useMemo(() => {
    const bayAngleRad = (bayAngle * Math.PI) / 180;
    const effectiveBayWidth = bayAngle === 90 ? bayWidth : bayWidth / Math.sin(bayAngleRad);
    const baysPerRow = Math.max(1, Math.floor(width / effectiveBayWidth));
    const result = [];

    for (let r = 0; r < rows; r++) {
      const rowZ = r * (bayDepth + aisleWidth);
      for (let b = 0; b < baysPerRow; b++) {
        const bx = b * effectiveBayWidth;
        result.push({ bx, rowZ, num: r * baysPerRow + b + 1 });
      }
    }
    return result;
  }, [width, rows, bayWidth, bayDepth, aisleWidth, bayAngle]);

  const totalDepth = rows * (bayDepth + aisleWidth);

  return (
    <group position={[ox, 0.01, oz]}>
      {/* Surface slab */}
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.1, totalDepth]} />
        <meshStandardMaterial color={surfaceColor} roughness={0.9} />
      </mesh>
      <primitive object={new THREE.Object3D()} position={[width / 2, 0.05, totalDepth / 2]} />

      {/* Bay divider lines (instanced) */}
      <BayLines bays={bays} bayWidth={bayWidth} bayDepth={bayDepth} bayAngle={bayAngle} />

      {/* Bay numbers */}
      {bays.map(({ bx, rowZ, num }) => (
        <Text
          key={num}
          position={[bx + bayWidth / 2, 0.12, rowZ + bayDepth * 0.6]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.3}
          color="#aaaaaa"
          anchorX="center"
          anchorY="middle"
        >
          {num}
        </Text>
      ))}

      {/* Disabled bay symbol (first bay) */}
      {bays[0] && (
        <mesh position={[bays[0].bx + bayWidth / 2, 0.06, bays[0].rowZ + bayDepth / 2]}>
          <planeGeometry args={[bayWidth * 0.6, bayDepth * 0.5]} />
          <meshStandardMaterial color="#1a4aaa" roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

function BayLines({ bays, bayWidth, bayDepth, bayAngle }) {
  const lines = useMemo(() => {
    const result = [];
    const processed = new Set();

    for (const { bx, rowZ } of bays) {
      const key = `${bx.toFixed(2)},${rowZ.toFixed(2)}`;
      if (processed.has(key)) continue;
      processed.add(key);

      // Left line of bay
      const pts = [
        new THREE.Vector3(bx, 0.02, rowZ),
        new THREE.Vector3(bx, 0.02, rowZ + bayDepth),
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      result.push(geom);

      // Right line (only for last bay in row)
      const rightPts = [
        new THREE.Vector3(bx + bayWidth, 0.02, rowZ),
        new THREE.Vector3(bx + bayWidth, 0.02, rowZ + bayDepth),
      ];
      result.push(new THREE.BufferGeometry().setFromPoints(rightPts));
    }

    return result;
  }, [bays, bayWidth, bayDepth]);

  return (
    <>
      {lines.map((geom, i) => (
        <line key={i} geometry={geom}>
          <lineBasicMaterial color="#eeeeee" linewidth={1} />
        </line>
      ))}
    </>
  );
}

/**
 * Speed bump — raised table geometry.
 */
export function SpeedBump3D({ position = [0, 0, 0], width = 7, depth = 0.9, height = 0.08 }) {
  return (
    <group position={position}>
      {/* Ramp up */}
      <mesh position={[0, height / 4, depth * 0.15]}>
        <boxGeometry args={[width, height / 2, depth * 0.3]} />
        <meshStandardMaterial color="#ffcc00" roughness={0.8} />
      </mesh>
      {/* Flat top */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height * 0.1, depth * 0.4]} />
        <meshStandardMaterial color="#ffcc00" roughness={0.8} />
      </mesh>
      {/* Ramp down */}
      <mesh position={[0, height / 4, -depth * 0.15]}>
        <boxGeometry args={[width, height / 2, depth * 0.3]} />
        <meshStandardMaterial color="#ffcc00" roughness={0.8} />
      </mesh>
    </group>
  );
}