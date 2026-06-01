import React from 'react';

export default function ConsumerUnit3D({ ways = 12, position = [0,0,0], isOpen = false }) {
  const width = 0.1 + (ways * 0.018); // 18mm per MCB module
  const height = 0.25;
  const depth = 0.1;

  return (
    <group position={position}>
      {/* CU Box */}
      <mesh position={[0, height/2, depth/2]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#dddddd" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Door (Animated in full version) */}
      <mesh position={[0, height/2, depth + 0.005]} rotation={[isOpen ? Math.PI/2 : 0, 0, 0]}>
        <boxGeometry args={[width, height, 0.01]} />
        <meshStandardMaterial color="#cccccc" transparent opacity={0.5} />
      </mesh>

      {/* MCBs */}
      {isOpen && (
        <group position={[0, height/2, depth/2 + 0.02]}>
          {Array.from({ length: ways }).map((_, i) => (
             <mesh key={i} position={[(i - (ways - 1) / 2) * 0.018, 0, 0.02]}>
               <boxGeometry args={[0.017, 0.08, 0.04]} />
               <meshStandardMaterial color={i === 0 ? "red" : "blue"} />
             </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
