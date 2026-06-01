import React from 'react';

export default function Fixture3D({ type, position = [0,0,0], rotation = [0,0,0] }) {
  
  if (type.includes('WC')) {
    return (
      <group position={position} rotation={rotation}>
        {/* Pan */}
        <mesh position={[0, 0.2, 0.2]}>
          <boxGeometry args={[0.36, 0.4, 0.5]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
        {/* Cistern */}
        <mesh position={[0, 0.6, -0.1]}>
          <boxGeometry args={[0.4, 0.4, 0.2]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
      </group>
    );
  }

  if (type.includes('Basin')) {
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry args={[0.5, 0.15, 0.4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
        {/* Tap */}
        <mesh position={[0, 0.1, 0.05]}>
          <cylinderGeometry args={[0.02, 0.02, 0.1]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.8} />
        </mesh>
      </group>
    );
  }

  if (type.includes('Shower')) {
    return (
      <group position={position} rotation={rotation}>
        {/* Tray */}
        <mesh position={[0, 0.05, 0.45]}>
          <boxGeometry args={[0.9, 0.1, 0.9]} />
          <meshStandardMaterial color="#eeeeee" />
        </mesh>
        {/* Glass Screen */}
        <mesh position={[0.45, 1, 0.45]}>
          <boxGeometry args={[0.02, 2, 0.9]} />
          <meshPhysicalMaterial transmission={0.9} roughness={0.1} color="white" transparent />
        </mesh>
      </group>
    );
  }

  // Fallback
  return (
    <group position={position} rotation={rotation}>
      <mesh><boxGeometry args={[0.4, 0.4, 0.4]}/><meshStandardMaterial color="white"/></mesh>
    </group>
  );
}
