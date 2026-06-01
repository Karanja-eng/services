import React from 'react';

export default function Drainage3D({ type, position = [0,0,0] }) {
  if (type.includes('Gully')) {
    return (
      <group position={position}>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
           <planeGeometry args={[0.2, 0.2]} />
           <meshStandardMaterial color="#111" wireframe />
        </mesh>
      </group>
    );
  }

  // Inspection Chamber
  if (type.includes('Chamber')) {
    return (
      <group position={position}>
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 1]} />
          <meshStandardMaterial color="#666666" />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.02]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
    );
  }

  return null;
}
