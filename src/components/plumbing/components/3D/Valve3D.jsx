import React from 'react';

export default function Valve3D({ type, position = [0,0,0], isOpen = true }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, 0.08]} rotation={[0, 0, Math.PI/2]} />
        <meshStandardMaterial color="#B87333" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Handle */}
      <mesh position={[0, 0.05, 0]} rotation={[0, isOpen ? 0 : Math.PI/2, 0]}>
        <boxGeometry args={[0.08, 0.01, 0.02]} />
        <meshStandardMaterial color={type.includes('Gate') ? 'red' : 'blue'} />
      </mesh>
    </group>
  );
}
