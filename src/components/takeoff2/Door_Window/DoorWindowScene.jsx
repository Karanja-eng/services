import React from "react";
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from "@react-three/drei";

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

const OpeningMesh = ({ opening, floorLevel, wallHeight, type, settings }) => {
    const { position, width, height, rotation, sillHeight } = opening;
    const zPos = type === 'window' ? (sillHeight || 0.9) : 0;

    const color = type === 'window' ? settings.windowColor : settings.doorColor;
    const frameColor = settings.frameColor;
    const opacity = settings.glassOpacity;
    const wireframe = settings.showWireframe;

    return (
        <group position={[position[0], (floorLevel * wallHeight) + zPos + height / 2, position[1]]} rotation={[0, -rotation, 0]}>
            <mesh castShadow>
                <boxGeometry args={[width, height, 0.2]} />
                <meshStandardMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* Frame */}
            <mesh>
                <boxGeometry args={[width + 0.05, height + 0.05, 0.1]} />
                <meshStandardMaterial color={frameColor} wireframe={wireframe} />
            </mesh>
        </group>
    );
};

export const DoorWindowScene = ({ buildingData, settings }) => {
    if (!buildingData) {
        // Fallback for when no data is provided - could render a placeholder or nothing
        return null;
    }

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
                    {floor.doors.map(d => <OpeningMesh key={d.id} opening={d} floorLevel={fIdx} wallHeight={buildingData.wallHeight} type="door" settings={settings} />)}
                    {floor.windows.map(w => <OpeningMesh key={w.id} opening={w} floorLevel={fIdx} wallHeight={buildingData.wallHeight} type="window" settings={settings} />)}
                </group>
            ))}
            <gridHelper args={[40, 40]} />
        </>
    );
};

export default DoorWindowScene;
