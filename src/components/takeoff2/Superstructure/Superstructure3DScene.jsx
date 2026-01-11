import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

// ============================================================================
// 3D COMPONENTS
// ============================================================================

const Wall = ({ wall, height, floorLevel, isSelected, onSelect }) => {
    const { start, end, thickness, segments } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const baseHeight = floorLevel * height;
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    const wallColor = isSelected ? "#3b82f6" : "#e2e8f0";

    if (segments && segments.length > 0) {
        return (
            <group onClick={(e) => { e.stopPropagation(); onSelect && onSelect(wall); }}>
                {segments.map((seg, idx) => {
                    const s = seg.start;
                    const e = seg.end;
                    const segLen = Math.sqrt(Math.pow(e[0] - s[0], 2) + Math.pow(e[1] - s[1], 2));
                    const mX = (s[0] + e[0]) / 2;
                    const mY = (s[1] + e[1]) / 2;
                    return (
                        <mesh key={idx} position={[mX, baseHeight + seg.offsetZ + seg.height / 2, mY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                            <boxGeometry args={[segLen, seg.height, thickness]} />
                            <meshStandardMaterial color={wallColor} roughness={0.6} metalness={0.1} />
                        </mesh>
                    );
                })}
            </group>
        );
    }

    return (
        <mesh position={[midX, baseHeight + height / 2, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect && onSelect(wall); }}>
            <boxGeometry args={[length, height, thickness]} />
            <meshStandardMaterial color={wallColor} roughness={0.6} metalness={0.1} />
        </mesh>
    );
};

const Window = ({ window, floorLevel, wallHeight, isSelected, onSelect }) => {
    const { position, width, height, rotation, sillHeight } = window;
    const baseHeight = floorLevel * wallHeight;
    const frameColor = isSelected ? "#3b82f6" : "#1e293b";

    return (
        <group position={[position[0], baseHeight + sillHeight, position[1]]} rotation={[0, rotation, 0]} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(window); }}>
            {/* Glass */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width - 0.1, height - 0.1, 0.02]} />
                <meshPhysicalMaterial color="#93c5fd" transparent opacity={0.4} transmission={0.9} roughness={0} />
            </mesh>
            {/* Frame - Outer */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height, 0.1]} />
                <meshStandardMaterial color={frameColor} wireframe={false} roughness={0.5} />
            </mesh>
            {/* Sill */}
            <mesh position={[0, 0, 0.08]} scale={[1.1, 1, 1]}>
                <boxGeometry args={[width, 0.05, 0.2]} />
                <meshStandardMaterial color={frameColor} />
            </mesh>
        </group>
    );
};

const Door = ({ door, floorLevel, wallHeight, isSelected, onSelect }) => {
    const { position, width, height, rotation } = door;
    const baseHeight = floorLevel * wallHeight;
    const frameColor = isSelected ? "#3b82f6" : "#475569";

    return (
        <group position={[position[0], baseHeight, position[1]]} rotation={[0, rotation, 0]} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(door); }}>
            {/* Frame */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width, height, 0.12]} />
                <meshStandardMaterial color={frameColor} />
            </mesh>
            {/* Leaf */}
            <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width - 0.08, height - 0.04, 0.04]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
            </mesh>
        </group>
    );
};

const FurnitureMesh = ({ item, floorLevel, wallHeight, isSelected, onSelect }) => {
    const [w, d, h] = item.size;
    const baseHeight = floorLevel * wallHeight;
    const color = isSelected ? "#3b82f6" : "#cbd5e1";

    return (
        <mesh position={[item.position[0], baseHeight + h / 2, item.position[1]]} rotation={[0, item.rotation, 0]} onClick={(e) => { e.stopPropagation(); onSelect && onSelect(item); }} castShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
    );
};

const RoomMesh = ({ room, floorLevel, wallHeight }) => {
    const shape = useMemo(() => {
        if (!room.polygon || room.polygon.length < 3) return null;
        const s = new THREE.Shape();
        s.moveTo(room.polygon[0][0], room.polygon[0][1]);
        room.polygon.slice(1).forEach(p => s.lineTo(p[0], p[1]));
        s.closePath();
        return s;
    }, [room.polygon]);

    const color = useMemo(() => {
        const t = room.type.toLowerCase();
        if (t.includes("bedroom")) return "#60a5fa";
        if (t.includes("bath")) return "#34d399";
        if (t.includes("kitchen")) return "#fb923c";
        if (t.includes("living")) return "#fbbf24";
        return "#94a3b8";
    }, [room.type]);

    if (!shape) return null;

    return (
        <mesh position={[0, floorLevel * wallHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={color} opacity={0.6} transparent roughness={1} />
        </mesh>
    );
};

const FloorSlab = ({ walls, thickness, floorLevel, wallHeight }) => {
    const bounds = useMemo(() => {
        if (!walls || !walls.length) return null;
        const pts = walls.flatMap(w => [w.start, w.end]);
        const xs = pts.map(p => p[0]);
        const ys = pts.map(p => p[1]);
        return {
            minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1,
            minY: Math.min(...ys) - 1, maxY: Math.max(...ys) + 1
        };
    }, [walls]);

    if (!bounds) return null;
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxY - bounds.minY;

    return (
        <mesh position={[(bounds.minX + bounds.maxX) / 2, floorLevel * wallHeight - thickness / 2, (bounds.minY + bounds.maxY) / 2]} receiveShadow>
            <boxGeometry args={[w, thickness, d]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </mesh>
    );
};

export const Superstructure3DScene = ({ buildingData, selectedId, onSelect, showFloor = true }) => {
    if (!buildingData) return null;
    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />

            {buildingData.floors.map((floor, fIdx) => (
                <group key={`f-${fIdx}`}>
                    {showFloor && <FloorSlab walls={floor.walls} thickness={0.15} floorLevel={fIdx} wallHeight={buildingData.wallHeight} />}
                    {floor.walls.map(w => (
                        <Wall key={w.id} wall={w} height={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === w.id} onSelect={onSelect} />
                    ))}
                    {floor.doors.map(d => (
                        <Door key={d.id} door={d} wallHeight={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === d.id} onSelect={onSelect} />
                    ))}
                    {floor.windows.map(w => (
                        <Window key={w.id} window={w} wallHeight={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === w.id} onSelect={onSelect} />
                    ))}
                    {floor.furniture && floor.furniture.map(item => (
                        <FurnitureMesh key={item.id} item={item} wallHeight={buildingData.wallHeight} floorLevel={fIdx} isSelected={selectedId === item.id} onSelect={onSelect} />
                    ))}
                    {floor.rooms.map(r => (
                        <RoomMesh key={r.id} room={r} floorLevel={fIdx} wallHeight={buildingData.wallHeight} />
                    ))}
                </group>
            ))}
            <gridHelper args={[100, 100, "#cbd5e1", "#f1f5f9"]} position={[0, -0.01, 0]} />
        </>
    );
};

export default Superstructure3DScene;
