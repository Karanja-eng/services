import React from 'react';

export default function Storage3D({ type, position = [0,0,0], capacity = 100 }) {
  
  const scale = Math.pow(capacity / 100, 1/3); // scale roughly by volume

  if (type.includes('Cold')) {
    return (
      <group position={position} scale={[scale, scale, scale]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} /> {/* Black plastic tank */}
        </mesh>
        <mesh position={[0, 1.01, 0]}>
          <boxGeometry args={[1.05, 0.05, 1.05]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      </group>
    );
  }

  if (type.includes('Cylinder')) {
    return (
      <group position={position} scale={[scale, scale, scale]}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 1.5, 32]} />
          <meshStandardMaterial color="#dddddd" roughness={0.4} /> {/* White foam insulated */}
        </mesh>
        <mesh position={[0, 1.5, 0]}>
           <sphereGeometry args={[0.3, 32, 16, 0, Math.PI*2, 0, Math.PI/2]} />
           <meshStandardMaterial color="#dddddd" roughness={0.4} />
        </mesh>
      </group>
    );
  }

  return null;
}
