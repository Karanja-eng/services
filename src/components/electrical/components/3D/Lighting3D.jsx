import React, { useRef } from 'react';

export default function Lighting3D({ type, position = [0,0,0], cct = 4000 }) {
  const lightRef = useRef();

  // Convert CCT to rough hex color
  const lightColor = cct < 3500 ? '#ffddaa' : cct < 5000 ? '#ffffff' : '#eefaff';

  return (
    <group position={position}>
      {/* Housing */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.1, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      
      {/* Emissive surface */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.01, 32]} />
        <meshBasicMaterial color={lightColor} />
      </mesh>

      {/* Actual Light Source */}
      <spotLight
        ref={lightRef}
        position={[0, -0.1, 0]}
        angle={Math.PI / 4}
        penumbra={0.5}
        color={lightColor}
        intensity={2}
        castShadow
      />
    </group>
  );
}
