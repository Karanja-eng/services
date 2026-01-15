import React, { useMemo } from "react";
import * as THREE from "three";

// Color codes for different components
const COLORS = {
    kerb: "#808080", // Gray
    channel: "#606060", // Dark gray
    invertBlock: "#505050", // Darker gray
    pccSlab: "#D3D3D3", // Light gray
    bitumen: "#1A1A1A", // Black
    murram: "#8B4513", // Brown
    hardcore: "#A0522D", // Darker brown
    sandBed: "#F4A460", // Sandy brown
    subBase: "#D2691E", // Chocolate
    baseCoarse: "#8B7355", // Tan
    wearingCourse: "#2F4F4F", // Dark slate gray
    concrete: "#C0C0C0", // Silver
    grass: "#228B22", // Forest green
    driveway: "#4A4A4A", // Charcoal
    parking: "#3A3A3A", // Dark charcoal
    cabro: "#CD853F", // Peru
    road: "#696969", // Dim gray
};

// Layer thickness (in meters)
const LAYER_THICKNESS = {
    kerb: 0.25,
    channel: 0.15,
    invertBlock: 0.35,
    pccSlab: 0.05,
    bitumen: 0.05,
    murram: 0.2,
    hardcore: 0.2,
    sandBed: 0.15,
    subBase: 0.15,
    baseCoarse: 0.15,
    wearingCourse: 0.04,
    concrete: 0.1,
};

// Component for a single pavement layer
function PavementLayer({ geometry, color, position, opacity = 1 }) {
    return (
        <mesh position={position} receiveShadow castShadow>
            <boxGeometry args={geometry} />
            <meshStandardMaterial
                color={color}
                opacity={opacity}
                transparent={opacity < 1}
                roughness={0.7}
                metalness={0.2}
            />
        </mesh>
    );
}

// Kerb component
function Kerb({ start, end, height = 0.25, width = 0.125 }) {
    const length = Math.sqrt(
        Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
    );
    const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
    const midPoint = [
        (start[0] + end[0]) / 2,
        height / 2,
        (start[2] + end[2]) / 2,
    ];

    return (
        <mesh position={midPoint} rotation={[0, angle, 0]} castShadow>
            <boxGeometry args={[length, height, width]} />
            <meshStandardMaterial color={COLORS.kerb} roughness={0.8} />
        </mesh>
    );
}

// Channel component
function Channel({ start, end, width = 0.125, depth = 0.1 }) {
    const length = Math.sqrt(
        Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
    );
    const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
    const midPoint = [
        (start[0] + end[0]) / 2,
        -depth / 2,
        (start[2] + end[2]) / 2,
    ];

    // Create V-shaped channel
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, -depth);
    shape.lineTo(width / 2, 0);

    const extrudeSettings = {
        steps: 1,
        depth: length,
        bevelEnabled: false,
    };

    return (
        <mesh position={midPoint} rotation={[0, angle, Math.PI / 2]} castShadow>
            <extrudeGeometry args={[shape, extrudeSettings]} />
            <meshStandardMaterial color={COLORS.channel} />
        </mesh>
    );
}

// Bellmouth curve component for pavement layers
function BellmouthCurve({ center, radius, thickness, color, startAngle = 0, endAngle = Math.PI / 2, yOffset = 0 }) {
    const shape = useMemo(() => {
        const shp = new THREE.Shape();
        // Create a sector-like shape for the bellmouth pavement
        shp.moveTo(center[0], center[2]);
        const segments = 32;
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / segments);
            shp.lineTo(
                center[0] + Math.cos(angle) * radius,
                center[2] + Math.sin(angle) * radius
            );
        }
        shp.lineTo(center[0], center[2]);
        shp.closePath();
        return shp;
    }, [center, radius, startAngle, endAngle]);

    return (
        <mesh
            position={[0, yOffset + thickness / 2, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
        >
            <extrudeGeometry
                args={[shape, { depth: thickness, bevelEnabled: false }]}
            />
            <meshStandardMaterial color={color} />
        </mesh>
    );
}

// Curved Kerb component
function CurvedKerb({ center, radius, startAngle, endAngle, height = 0.25, width = 0.125 }) {
    const points = useMemo(() => {
        const pts = [];
        const segments = 32;
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / segments);
            pts.push(new THREE.Vector2(
                center[0] + Math.cos(angle) * (radius + width / 2),
                center[2] + Math.sin(angle) * (radius + width / 2)
            ));
        }
        return pts;
    }, [center, radius, startAngle, endAngle, width]);

    const shape = useMemo(() => {
        const shp = new THREE.Shape();
        shp.moveTo(points[0].x, points[0].y);
        points.forEach(p => shp.lineTo(p.x, p.y));
        // Narrow path for the kerb
        for (let i = points.length - 1; i >= 0; i--) {
            const angle = startAngle + (endAngle - startAngle) * (i / (points.length - 1));
            shp.lineTo(
                center[0] + Math.cos(angle) * (radius - width / 2),
                center[2] + Math.sin(angle) * (radius - width / 2)
            );
        }
        shp.closePath();
        return shp;
    }, [center, radius, startAngle, endAngle, points, width]);

    return (
        <mesh position={[0, height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <extrudeGeometry args={[shape, { depth: height, bevelEnabled: false }]} />
            <meshStandardMaterial color={COLORS.kerb} roughness={0.8} />
        </mesh>
    );
}

// Curved Channel component
function CurvedChannel({ center, radius, startAngle, endAngle, width = 0.2, depth = 0.1 }) {
    // Similar to CurvedKerb but for the channel
    const points = useMemo(() => {
        const pts = [];
        const segments = 32;
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (endAngle - startAngle) * (i / segments);
            pts.push(new THREE.Vector2(
                center[0] + Math.cos(angle) * radius,
                center[2] + Math.sin(angle) * radius
            ));
        }
        return pts;
    }, [center, radius, startAngle, endAngle]);

    const geometry = useMemo(() => {
        const curve = new THREE.CatmullRomCurve3(
            points.map(p => new THREE.Vector3(p.x, 0, p.y))
        );
        // Create a V-shape cross section
        const shape = new THREE.Shape();
        shape.moveTo(-width / 2, 0);
        shape.lineTo(0, -depth);
        shape.lineTo(width / 2, 0);
        shape.closePath();

        return new THREE.ExtrudeGeometry(shape, {
            steps: 32,
            extrudePath: curve,
            bevelEnabled: false
        });
    }, [points, width, depth]);

    return (
        <mesh geometry={geometry} castShadow>
            <meshStandardMaterial color={COLORS.channel} />
        </mesh>
    );
}

// Road marking component
function RoadMarking({ start, end, width = 0.1, dashed = false }) {
    if (dashed) {
        const length = Math.sqrt(
            Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
        );
        const dashLength = 2;
        const gapLength = 1;
        const numDashes = Math.floor(length / (dashLength + gapLength));
        const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);

        return (
            <>
                {Array.from({ length: numDashes }).map((_, i) => {
                    const dashStart = i * (dashLength + gapLength);
                    const x = start[0] + Math.cos(angle) * (dashStart + dashLength / 2);
                    const z = start[2] + Math.sin(angle) * (dashStart + dashLength / 2);
                    return (
                        <mesh key={i} position={[x, 0.051, z]} rotation={[0, angle, 0]}>
                            <boxGeometry args={[dashLength, 0.001, width]} />
                            <meshStandardMaterial
                                color="#FFFFFF"
                                emissive="#FFFFFF"
                                emissiveIntensity={0.2}
                            />
                        </mesh>
                    );
                })}
            </>
        );
    }

    const length = Math.sqrt(
        Math.pow(end[0] - start[0], 2) + Math.pow(end[2] - start[2], 2)
    );
    const angle = Math.atan2(end[2] - start[2], end[0] - start[0]);
    const midPoint = [(start[0] + end[0]) / 2, 0.051, (start[2] + end[2]) / 2];

    return (
        <mesh position={midPoint} rotation={[0, angle, 0]}>
            <boxGeometry args={[length, 0.001, width]} />
            <meshStandardMaterial
                color="#FFFFFF"
                emissive="#FFFFFF"
                emissiveIntensity={0.2}
            />
        </mesh>
    );
}

// Tree component
function Tree({ position, type = "ornamental" }) {
    return (
        <group position={position}>
            {/* Trunk */}
            <mesh position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.15, 1, 8]} />
                <meshStandardMaterial color="#4B3621" />
            </mesh>
            {/* Foliage */}
            <mesh position={[0, 1.5, 0]} castShadow>
                <sphereGeometry args={[0.7, 16, 16]} />
                <meshStandardMaterial color="#228B22" />
            </mesh>
        </group>
    );
}

export function ExternalWorksScene({ settings }) {
    // Use settings directly or fallback to defaults if needed
    const config = settings || {};

    const {
        roadWidth = 9,
        roadLength = 40,
        roadRotation = 0,
        parkingWidth = 10,
        parkingLength = 20,
        parkingRotation = 90,
        parkingPosX = 10,
        parkingPosZ = 0,
        bellmouthRadius1 = 6,
        bellmouthRadius2 = 6,
        surfaceType = "bitumen",
        showLayers = {}
    } = config;

    // Ensure showLayers has defaults if partial
    const visibility = {
        subBase: showLayers.subBase !== false,
        hardcore: showLayers.hardcore !== false,
        baseCoarse: showLayers.baseCoarse !== false,
        bitumen: showLayers.bitumen !== false,
        kerb: showLayers.kerb !== false,
        channel: showLayers.channel !== false,
        invertBlock: showLayers.invertBlock !== false,
        bellmouth: showLayers.bellmouth !== false,
    };


    const degToRad = (deg) => (deg * Math.PI) / 180;

    // Render logic for pavement layers
    const renderPavement = (width, length, color, isParking = false) => (
        <group>
            {visibility.subBase && (
                <PavementLayer
                    geometry={[length, LAYER_THICKNESS.subBase, width]}
                    color={COLORS.subBase}
                    position={[0, -0.475, 0]}
                />
            )}
            {visibility.hardcore && (
                <PavementLayer
                    geometry={[length, LAYER_THICKNESS.hardcore, width]}
                    color={COLORS.hardcore}
                    position={[0, -0.3, 0]}
                />
            )}
            {!isParking && visibility.baseCoarse && (
                <PavementLayer
                    geometry={[length, LAYER_THICKNESS.baseCoarse, width]}
                    color={COLORS.baseCoarse}
                    position={[0, -0.125, 0]}
                />
            )}
            {visibility.bitumen && (
                <PavementLayer
                    geometry={[length, LAYER_THICKNESS.bitumen, width]}
                    color={isParking ? COLORS.parking : (surfaceType === "bitumen" ? COLORS.bitumen : COLORS.cabro)}
                    position={[0, -0.025, 0]}
                />
            )}
        </group>
    );

    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color={COLORS.grass} />
            </mesh>

            {/* Main Road Group */}
            <group rotation={[0, degToRad(roadRotation), 0]}>
                {renderPavement(roadWidth, roadLength, COLORS.bitumen)}

                {/* Road markings */}
                {surfaceType === "bitumen" && (
                    <group position={[0, 0.01, 0]}>
                        <RoadMarking start={[-roadLength / 2, 0, 0]} end={[roadLength / 2, 0, 0]} dashed={true} />
                        <RoadMarking start={[-roadLength / 2, 0, -roadWidth / 2 + 0.2]} end={[roadLength / 2, 0, -roadWidth / 2 + 0.2]} width={0.15} />
                        <RoadMarking start={[-roadLength / 2, 0, roadWidth / 2 - 0.2]} end={[roadLength / 2, 0, roadWidth / 2 - 0.2]} width={0.15} />
                    </group>
                )}

                {/* Kerbs & Channels for Road */}
                {visibility.kerb && (
                    <>
                        <Kerb start={[-roadLength / 2, 0, -roadWidth / 2]} end={[roadLength / 2, 0, -roadWidth / 2]} />
                        <Kerb start={[-roadLength / 2, 0, roadWidth / 2]} end={[roadLength / 2, 0, roadWidth / 2]} />
                    </>
                )}
            </group>

            {/* Access Road / Parking Group */}
            <group position={[parkingPosX, 0, parkingPosZ]} rotation={[0, degToRad(parkingRotation), 0]}>
                {renderPavement(parkingWidth, parkingLength, COLORS.parking, true)}

                {/* Parking Bay Markings */}
                <group position={[0, 0.01, 0]}>
                    {Array.from({ length: Math.max(1, Math.floor(parkingLength / 2.5)) }).map((_, i) => (
                        <RoadMarking
                            key={i}
                            start={[-parkingLength / 2 + i * 2.5, 0, -parkingWidth / 2]}
                            end={[-parkingLength / 2 + i * 2.5, 0, parkingWidth / 2]}
                            width={0.1}
                        />
                    ))}
                    {/* Central line for double-sided parking if wide enough */}
                    {parkingWidth > 10 && (
                        <RoadMarking start={[-parkingLength / 2, 0, 0]} end={[parkingLength / 2, 0, 0]} width={0.1} />
                    )}
                </group>

                {/* Kerbs & Channels for Parking */}
                {visibility.kerb && (
                    <>
                        <Kerb start={[-parkingLength / 2, 0, -parkingWidth / 2]} end={[parkingLength / 2, 0, -parkingWidth / 2]} />
                        <Kerb start={[-parkingLength / 2, 0, parkingWidth / 2]} end={[parkingLength / 2, 0, parkingWidth / 2]} />
                        <Kerb start={[parkingLength / 2, 0, -parkingWidth / 2]} end={[parkingLength / 2, 0, parkingWidth / 2]} />
                    </>
                )}

                {/* Bellmouth Junctions - Attached to the START of the parking road */}
                {visibility.bellmouth && (
                    <>
                        {/* Left Bellmouth Layers */}
                        {visibility.subBase && (
                            <BellmouthCurve
                                center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                                radius={bellmouthRadius1}
                                thickness={LAYER_THICKNESS.subBase}
                                color={COLORS.subBase}
                                startAngle={0}
                                endAngle={Math.PI / 2}
                                yOffset={-0.55}
                            />
                        )}
                        {visibility.hardcore && (
                            <BellmouthCurve
                                center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                                radius={bellmouthRadius1}
                                thickness={LAYER_THICKNESS.hardcore}
                                color={COLORS.hardcore}
                                startAngle={0}
                                endAngle={Math.PI / 2}
                                yOffset={-0.4}
                            />
                        )}
                        {visibility.bitumen && (
                            <BellmouthCurve
                                center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                                radius={bellmouthRadius1}
                                thickness={LAYER_THICKNESS.bitumen}
                                color={COLORS.bitumen}
                                startAngle={0}
                                endAngle={Math.PI / 2}
                                yOffset={-0.05}
                            />
                        )}

                        {/* Right Bellmouth Layers */}
                        {visibility.subBase && (
                            <BellmouthCurve
                                center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                                radius={bellmouthRadius2}
                                thickness={LAYER_THICKNESS.subBase}
                                color={COLORS.subBase}
                                startAngle={-Math.PI / 2}
                                endAngle={0}
                                yOffset={-0.55}
                            />
                        )}
                        {visibility.hardcore && (
                            <BellmouthCurve
                                center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                                radius={bellmouthRadius2}
                                thickness={LAYER_THICKNESS.hardcore}
                                color={COLORS.hardcore}
                                startAngle={-Math.PI / 2}
                                endAngle={0}
                                yOffset={-0.4}
                            />
                        )}
                        {visibility.bitumen && (
                            <BellmouthCurve
                                center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                                radius={bellmouthRadius2}
                                thickness={LAYER_THICKNESS.bitumen}
                                color={COLORS.bitumen}
                                startAngle={-Math.PI / 2}
                                endAngle={0}
                                yOffset={-0.05}
                            />
                        )}

                        {/* Curved Kerbs for Bellmouth */}
                        {visibility.kerb && (
                            <>
                                <CurvedKerb
                                    center={[-parkingLength / 2, 0, -parkingWidth / 2 - bellmouthRadius1]}
                                    radius={bellmouthRadius1}
                                    startAngle={0}
                                    endAngle={Math.PI / 2}
                                />
                                <CurvedKerb
                                    center={[-parkingLength / 2, 0, parkingWidth / 2 + bellmouthRadius2]}
                                    radius={bellmouthRadius2}
                                    startAngle={-Math.PI / 2}
                                    endAngle={0}
                                />
                            </>
                        )}
                    </>
                )}
            </group>

            {/* Nature decoration */}
            <Tree position={[25, 0, 15]} />
            <Tree position={[-25, 0, -15]} />
            <Tree position={[15, 0, -25]} />
        </>
    );
}

export default ExternalWorksScene;
