import React, { useMemo } from "react";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

const TechPoint = ({ point, color, settings }) => {
    const { position, height } = point;
    // height comes from point.height (z coordinate in input data)

    return (
        <group position={[position[0], height, position[1]]}>
            <mesh castShadow>
                <boxGeometry args={[0.08, 0.12, 0.04]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, -height / 2, 0]}>
                <cylinderGeometry args={[0.01, 0.01, height]} />
                <meshStandardMaterial color="#64748b" transparent opacity={0.3} />
            </mesh>
        </group>
    );
};

const ConduitPipe = ({ conduit, settings }) => {
    const { path, type } = conduit;
    const points = useMemo(() => path.map(p => new THREE.Vector3(p[0], p[2], p[1])), [path]);
    const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

    const color = type === "electrical" ? settings.electricalColor : settings.plumbingColor;

    return (
        <mesh castShadow>
            <tubeGeometry args={[curve, 64, 0.015, 8, false]} />
            <meshStandardMaterial color={color} roughness={0.3} />
        </mesh>
    );
};

const TransparentWall = ({ wall, height, settings }) => {
    const { start, end, thickness } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    return (
        <mesh position={[midX, height / 2, midY]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[length, height, thickness]} />
            <meshStandardMaterial
                color={settings.wallColor}
                transparent
                opacity={settings.wallOpacity}
                depthWrite={false}
            />
        </mesh>
    );
};

export const ElectricalPlumbingScene = ({ buildingData, settings }) => {
    if (!buildingData) return null;
    const floor = buildingData.floors[0];

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[12, 12, 12]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 15, 10]} intensity={2} castShadow />

            <group>
                {floor.walls.map(w => (
                    <TransparentWall key={w.id} wall={w} height={buildingData.totalHeight || 3.0} settings={settings} />
                ))}

                {floor.electrical && floor.electrical.map(pt => (
                    <TechPoint key={pt.id} point={pt} color={settings.electricalColor} settings={settings} />
                ))}

                {floor.plumbing && floor.plumbing.map(pt => (
                    <TechPoint key={pt.id} point={pt} color={settings.plumbingColor} settings={settings} />
                ))}

                {floor.conduits && floor.conduits.map(c => (
                    <ConduitPipe key={c.id} conduit={c} settings={settings} />
                ))}
            </group>

            <gridHelper args={[50, 50]} position={[0, -0.01, 0]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color={settings.groundColor} />
            </mesh>
        </>
    );
};

export default ElectricalPlumbingScene;
