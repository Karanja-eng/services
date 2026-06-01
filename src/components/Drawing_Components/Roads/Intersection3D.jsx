import React, { useMemo } from 'react';
import * as THREE from 'three';
import { buildRoundaboutGeometry } from './roadGeometry';

/**
 * T-Junction: three roads meeting at a point, flared apron.
 */
export function TJunction3D({ center = [0, 0, 0], width = 7, material = 'asphalt' }) {
  const [cx, cy, cz] = center;
  const color = material === 'concrete' ? '#b0a898' : '#1c1c1c';
  const apronR = width * 0.85;

  return (
    <group position={[cx, cy, cz]}>
      {/* Central apron */}
      <mesh receiveShadow>
        <cylinderGeometry args={[apronR, apronR, 0.12, 32, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

/**
 * Crossroads: four roads meeting, square apron.
 */
export function Crossroads3D({ center = [0, 0, 0], width = 7, material = 'asphalt' }) {
  const [cx, cy, cz] = center;
  const color = material === 'concrete' ? '#b0a898' : '#1c1c1c';

  return (
    <group position={[cx, cy, cz]}>
      <mesh receiveShadow>
        <boxGeometry args={[width, 0.12, width]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* Stop line markings — all four arms */}
      {[0, 90, 180, 270].map(angle => (
        <mesh
          key={angle}
          position={[
            Math.cos((angle * Math.PI) / 180) * (width / 2 - 0.15),
            0.065,
            Math.sin((angle * Math.PI) / 180) * (width / 2 - 0.15),
          ]}
          rotation={[0, (angle * Math.PI) / 180 + Math.PI / 2, 0]}
        >
          <boxGeometry args={[width, 0.01, 0.3]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Roundabout: ring carriageway + central island.
 */
export function Roundabout3D({ center = [0, 0, 0], outerRadius = 12, innerRadius = 4, laneWidth = 4, material = 'asphalt' }) {
  const [cx, cy, cz] = center;
  const color = material === 'concrete' ? '#b0a898' : '#1c1c1c';

  const ringGeom = useMemo(
    () => buildRoundaboutGeometry([0, 0, 0], outerRadius, innerRadius),
    [outerRadius, innerRadius]
  );

  return (
    <group position={[cx, cy, cz]}>
      {/* Carriageway ring */}
      <mesh geometry={ringGeom} receiveShadow>
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* Central island (raised grass) */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[innerRadius - 0.3, innerRadius, 0.5, 48]} />
        <meshStandardMaterial color="#3d6b35" roughness={1.0} />
      </mesh>

      {/* Kerb ring on island edge */}
      <mesh position={[0, 0.15, 0]}>
        <torusGeometry args={[innerRadius - 0.05, 0.08, 6, 64]} />
        <meshStandardMaterial color="#555555" roughness={0.7} />
      </mesh>

      {/* Outer kerb ring */}
      <mesh position={[0, 0.08, 0]}>
        <torusGeometry args={[outerRadius + 0.05, 0.08, 6, 64]} />
        <meshStandardMaterial color="#555555" roughness={0.7} />
      </mesh>

      {/* Lane marking — dashed centre circle */}
      <mesh position={[0, 0.07, 0]}>
        <torusGeometry args={[(outerRadius + innerRadius) / 2, 0.04, 4, 64]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Yield triangles at entries (4 arms) */}
      {[0, 90, 180, 270].map(angle => (
        <YieldMark key={angle} angle={angle} radius={outerRadius + 0.5} />
      ))}
    </group>
  );
}

function YieldMark({ angle, radius }) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const z = Math.sin(rad) * radius;
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.5, 1); s.lineTo(-0.5, 1); s.closePath();
    return s;
  }, []);

  return (
    <mesh
      position={[x, 0.07, z]}
      rotation={[0, -rad + Math.PI / 2, 0]}
    >
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#ff4444" roughness={0.5} side={THREE.DoubleSide}
        polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  );
}

/**
 * Road sign post (stop, yield, speed limit).
 */
export function RoadSign3D({ position = [0, 0, 0], type = 'stop', speedLimit = 30 }) {
  const [x, y, z] = position;

  return (
    <group position={[x, y, z]}>
      {/* Post */}
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.05, 2.5, 6]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Sign face */}
      {type === 'stop' && (
        <mesh position={[0, 2.7, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.04, 8]} />
          <meshStandardMaterial color="#cc2020" roughness={0.3} />
        </mesh>
      )}
      {type === 'speed' && (
        <mesh position={[0, 2.6, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
      )}
      {type === 'yield' && (
        <mesh position={[0, 2.6, 0]} rotation={[0, 0, Math.PI]} castShadow>
          <coneGeometry args={[0.35, 0.04, 3]} />
          <meshStandardMaterial color="#ee2020" roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}