import React, { Suspense } from "react";
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

const WallOverlay = ({ wall, height, floorLevel }) => {
    const { start, end, thickness } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;
    return (
        <mesh position={[midX, (floorLevel * height) + height / 2, midY]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[length, height, thickness]} />
            <meshStandardMaterial color="#cbd5e1" transparent opacity={0.1} />
        </mesh>
    );
};

const OpeningMesh = ({ opening, floorLevel, wallHeight, type }) => {
    const { position, width, height, rotation, sillHeight } = opening;
    const zPos = type === 'window' ? (sillHeight || 0.9) : 0;

    return (
        <group position={[position[0], (floorLevel * wallHeight) + zPos + height / 2, position[1]]} rotation={[0, -rotation, 0]}>
            <mesh castShadow>
                <boxGeometry args={[width, height, 0.2]} />
                <meshStandardMaterial color={type === 'window' ? "#38bdf8" : "#92400e"} transparent opacity={0.6} />
            </mesh>
            {/* Frame */}
            <mesh>
                <boxGeometry args={[width + 0.05, height + 0.05, 0.1]} />
                <meshStandardMaterial color="#1e293b" wireframe />
            </mesh>
        </group>
    );
};

export const DoorWindow3DScene = ({ buildingData }) => {
    if (!buildingData) return null;
    return (
        <>
            <PerspectiveCamera makeDefault position={[10, 8, 10]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
            <ContactShadows opacity={0.4} scale={20} blur={2.4} far={4.5} />

            {buildingData.floors.map((floor, fIdx) => (
                <group key={`f-${fIdx}`}>
                    {floor.walls.map(w => <WallOverlay key={w.id} wall={w} height={buildingData.wallHeight} floorLevel={fIdx} />)}
                    {floor.doors.map(d => <OpeningMesh key={d.id} opening={d} floorLevel={fIdx} wallHeight={buildingData.wallHeight} type="door" />)}
                    {floor.windows.map(w => <OpeningMesh key={w.id} opening={w} floorLevel={fIdx} wallHeight={buildingData.wallHeight} type="window" />)}
                </group>
            ))}
            <gridHelper args={[40, 40]} />
        </>
    );
};

export default DoorWindow3DScene;
