import React, { useMemo } from 'react';
import * as THREE from 'three';
import { COLORS } from '../../utils/constants';

export default function Pipe3D({ points, size = 15, material = 'Copper', system = 'CWS' }) {
  const color = COLORS[system] || '#cccccc';
  
  const curve = useMemo(() => {
    if (!points || points.length < 2) return null;
    const v3Array = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
    return new THREE.CatmullRomCurve3(v3Array, false, 'catmullrom', 0.1);
  }, [points]);

  if (!curve) return null;

  const radius = size / 2000; // rough mm to meters conversion for viz
  
  const isMetal = material === 'Copper' || material.includes('Steel');

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, radius, 8, false]} />
        <meshStandardMaterial 
          color={color} 
          metalness={isMetal ? 0.8 : 0.1}
          roughness={isMetal ? 0.2 : 0.6}
          wireframe={system === 'HWR'} // Hack to show dashed effect
        />
      </mesh>
    </group>
  );
}
