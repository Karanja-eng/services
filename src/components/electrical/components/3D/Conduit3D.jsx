import React, { useMemo } from 'react';
import * as THREE from 'three';
import { COLORS } from '../../utils/constants';

export default function Conduit3D({ points, type = 'pvc_20mm', system = 'power' }) {
  const color = system === 'power' ? COLORS.POWER : system === 'data' ? COLORS.DATA : COLORS.CONDUIT_PVC;
  
  const curve = useMemo(() => {
    if (!points || points.length < 2) return null;
    const v3Array = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
    // Use CatmullRomCurve3 for smooth bends if needed, or straight lines
    return new THREE.CatmullRomCurve3(v3Array, false, 'catmullrom', 0.1);
  }, [points]);

  if (!curve) return null;

  const radius = type.includes('20') ? 0.01 : type.includes('25') ? 0.0125 : 0.016;

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, radius, 8, false]} />
        <meshStandardMaterial 
          color={color} 
          metalness={type.includes('steel') ? 0.8 : 0.1}
          roughness={type.includes('steel') ? 0.3 : 0.7}
        />
      </mesh>
    </group>
  );
}
