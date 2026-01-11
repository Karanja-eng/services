import React, { useMemo } from "react";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

const FoundationWall = ({ wall, height, depth }) => {
    const { start, end, thickness } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    return (
        <group>
            {/* Foundation Wall */}
            <mesh position={[midX, -height / 2, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[length, height, thickness]} />
                <meshStandardMaterial color="#64748b" roughness={0.8} />
            </mesh>
            {/* Strip Foundation */}
            <mesh position={[midX, -height - 0.1, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[length + 0.2, 0.2, thickness + 0.4]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>
        </group>
    );
};

const ColumnBase = ({ column, height }) => {
    const { position, size } = column;
    const s = size || 0.2;
    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Foundation Column */}
            <mesh position={[0, -height / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s, height, s]} />
                <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Column Base */}
            <mesh position={[0, -height - 0.15, 0]} castShadow receiveShadow>
                <boxGeometry args={[s + 0.6, 0.3, s + 0.6]} />
                <meshStandardMaterial color="#cbd5e1" />
            </mesh>
        </group>
    );
};

export const Substructure3DScene = ({ buildingData }) => {
    if (!buildingData) return null;
    const foundationHeight = 1.2; // Assumed typical substructure depth

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[10, -5, 15]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />

            <group>
                {buildingData.floors[0].walls.map(w => (
                    <FoundationWall key={w.id} wall={w} height={foundationHeight} />
                ))}
                {buildingData.floors[0].columns.map((c, i) => (
                    <ColumnBase key={i} column={c} height={foundationHeight} />
                ))}
            </group>
            {/* Ground Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#1e293b" transparent opacity={0.4} />
            </mesh>
            <gridHelper args={[100, 100]} position={[0, 0, 0]} />
        </>
    );
};

export default Substructure3DScene;
