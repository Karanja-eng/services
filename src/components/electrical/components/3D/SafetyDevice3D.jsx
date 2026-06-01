import React from 'react';

export default function SafetyDevice3D({ type, position = [0,0,0], rotation = [0,0,0] }) {
  
  if (type === 'smoke_detector') {
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 32]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* LED Indicator */}
        <mesh position={[0.03, -0.02, 0]}>
          <sphereGeometry args={[0.002, 8, 8]} />
          <meshBasicMaterial color="red" />
        </mesh>
      </group>
    );
  }

  if (type === 'call_point') {
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, 0, 0.015]}>
          <boxGeometry args={[0.086, 0.086, 0.03]} />
          <meshStandardMaterial color="#cc0000" />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[0.06, 0.06, 0.005]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      </group>
    );
  }

  // Fallback
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.05, 0.05, 0.05]}/><meshStandardMaterial color="gray"/></mesh>
    </group>
  );
}
