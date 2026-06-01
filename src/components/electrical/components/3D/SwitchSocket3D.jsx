import React from 'react';

export default function SwitchSocket3D({ type, gang = 1, position = [0,0,0], rotation = [0,0,0], material = 'white' }) {
  const width = gang === 1 ? 0.086 : 0.147;
  const height = 0.086;
  const depth = 0.01; // Front plate depth

  const matProps = material === 'chrome' 
    ? { metalness: 0.9, roughness: 0.1, color: '#e0e0e0' }
    : { metalness: 0.1, roughness: 0.8, color: '#ffffff' };

  return (
    <group position={position} rotation={rotation}>
      {/* Back box / Plate */}
      <mesh position={[0, height/2, depth/2]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...matProps} />
      </mesh>

      {/* Rockers / Sockets mock */}
      {Array.from({ length: gang }).map((_, i) => (
        <group key={i} position={[(i - (gang - 1) / 2) * 0.04, height/2, depth]}>
          {type.includes('switch') ? (
            <mesh position={[0, 0, 0.002]}>
               <boxGeometry args={[0.015, 0.03, 0.004]} />
               <meshStandardMaterial color="#eeeeee" />
            </mesh>
          ) : (
            <group>
              {/* Fake socket holes */}
              <mesh position={[-0.01, -0.01, 0.001]}><boxGeometry args={[0.004, 0.01, 0.002]} /><meshBasicMaterial color="black" /></mesh>
              <mesh position={[0.01, -0.01, 0.001]}><boxGeometry args={[0.004, 0.01, 0.002]} /><meshBasicMaterial color="black" /></mesh>
              <mesh position={[0, 0.01, 0.001]}><boxGeometry args={[0.005, 0.015, 0.002]} /><meshBasicMaterial color="black" /></mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
