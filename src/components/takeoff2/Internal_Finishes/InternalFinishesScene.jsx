import React, { useMemo } from "react";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

const RoomFinishes = ({ room, floorLevel, wallHeight, settings }) => {
    const shape = useMemo(() => {
        if (!room.polygon || room.polygon.length < 3) return null;
        const s = new THREE.Shape();
        s.moveTo(room.polygon[0][0], room.polygon[0][1]);
        room.polygon.slice(1).forEach(p => s.lineTo(p[0], p[1]));
        s.closePath();
        return s;
    }, [room.polygon]);

    const color = useMemo(() => {
        const t = (room.type || "").toLowerCase();
        if (t.includes("bedroom")) return settings.bedroomColor;
        if (t.includes("bath")) return settings.bathColor;
        if (t.includes("kitchen")) return settings.kitchenColor;
        if (t.includes("living")) return settings.livingColor;
        return settings.defaultFloorColor;
    }, [room.type, settings]);

    if (!shape) return null;

    const baseHeight = floorLevel * wallHeight;

    return (
        <group>
            {/* Floor Finish */}
            <mesh position={[0, baseHeight + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <shapeGeometry args={[shape]} />
                <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
            {/* Ceiling Finish */}
            {settings.showCeiling && (
                <mesh position={[0, baseHeight + wallHeight - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
                    <shapeGeometry args={[shape]} />
                    <meshStandardMaterial color={settings.ceilingColor} roughness={1} />
                </mesh>
            )}
        </group>
    );
};

const InternalWall = ({ wall, height, floorLevel, settings }) => {
    const { start, end, thickness } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const baseHeight = floorLevel * height;
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    return (
        <mesh position={[midX, baseHeight + height / 2, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, height, thickness]} />
            <meshStandardMaterial
                color={settings.wallColor}
                roughness={0.9}
                transparent
                opacity={settings.wallOpacity}
            />
        </mesh>
    );
};

export const InternalFinishesScene = ({ buildingData, settings }) => {
    if (!buildingData) return null;
    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[12, 12, 12]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />

            {buildingData.floors.map((floor, fIdx) => (
                <group key={`f-${fIdx}`}>
                    {floor.rooms.map(r => (
                        <RoomFinishes key={r.id} room={r} floorLevel={fIdx} wallHeight={buildingData.wallHeight} settings={settings} />
                    ))}
                    {floor.walls.map(w => (
                        <InternalWall key={w.id} wall={w} height={buildingData.wallHeight} floorLevel={fIdx} settings={settings} />
                    ))}
                </group>
            ))}
            <gridHelper args={[50, 50]} position={[0, -0.01, 0]} />
        </>
    );
};

export default InternalFinishesScene;
