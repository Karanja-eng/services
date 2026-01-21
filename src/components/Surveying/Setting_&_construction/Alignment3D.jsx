import React, { useState, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

// UI Components replacement for Shadcn
const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
        {children}
    </div>
);

const CardHeader = ({ children }) => (
    <div className="p-6 pb-2">
        {children}
    </div>
);

const CardTitle = ({ children, className = "" }) => (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
        {children}
    </h3>
);

const CardContent = ({ children, className = "" }) => (
    <div className={`p-6 pt-2 ${className}`}>
        {children}
    </div>
);

const Label = ({ children, className = "" }) => (
    <label className={`block text-sm font-medium text-gray-700 mb-1.5 ${className}`}>
        {children}
    </label>
);

const Input = ({ className = "", ...props }) => (
    <input
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
    />
);

const Checkbox = ({ checked, onCheckedChange, id }) => (
    <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
    />
);

// Ground plane with grid
const GroundPlane = ({ size = 500, divisions = 50 }) => {
    const gridPoints = useMemo(() => {
        const points = [];
        const halfSize = size / 2;
        const step = size / divisions;

        for (let i = 0; i <= divisions; i++) {
            const pos = -halfSize + i * step;
            points.push(
                [-halfSize, 0, pos], [halfSize, 0, pos],
                [pos, 0, -halfSize], [pos, 0, halfSize]
            );
        }

        return points;
    }, [size, divisions]);

    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
                <planeGeometry args={[size, size]} />
                <meshBasicMaterial color="#f9fafb" side={THREE.DoubleSide} />
            </mesh>

            <Line
                points={gridPoints}
                color="#e5e7eb"
                lineWidth={0.5}
                segments
            />
        </>
    );
};

// Horizontal alignment centerline
const HorizontalCenterline = ({ radius, angle, segments = 50, color = "#374151" }) => {
    const points = useMemo(() => {
        const pts = [];
        const angleRad = (angle * Math.PI) / 180;

        for (let i = -10; i <= 0; i++) {
            pts.push([i * 5, 0, 0]);
        }

        for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * angleRad;
            const x = radius * Math.sin(t);
            const z = -radius * (1 - Math.cos(t));
            pts.push([x, 0, z]);
        }

        const exitAngle = angleRad;
        const exitX = radius * Math.sin(angleRad);
        const exitZ = -radius * (1 - Math.cos(angleRad));

        for (let i = 1; i <= 10; i++) {
            const x = exitX + i * 5 * Math.sin(exitAngle);
            const z = exitZ - i * 5 * Math.cos(exitAngle);
            pts.push([x, 0, z]);
        }

        return pts;
    }, [radius, angle, segments]);

    return (
        <Line
            points={points}
            color={color}
            lineWidth={3}
        />
    );
};

// Vertical profile as extruded surface
const VerticalProfile = ({ horizontalPoints, gradeIn, gradeOut, curveLength, showProfile }) => {
    if (!showProfile) return null;

    const geometry = useMemo(() => {
        const g = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];

        const numPoints = horizontalPoints.length;
        const totalLength = curveLength;

        for (let i = 0; i < numPoints; i++) {
            const [x, , z] = horizontalPoints[i];
            const chainage = (i / (numPoints - 1)) * totalLength;

            const gradeInDec = gradeIn / 100;
            const gradeOutDec = gradeOut / 100;
            const A = gradeInDec - gradeOutDec;

            let y = 0;
            if (chainage <= totalLength / 2) {
                y = gradeInDec * chainage;
            } else {
                const x_dist = chainage - totalLength / 2;
                y = gradeInDec * (totalLength / 2) + (A / (2 * totalLength)) * x_dist * x_dist;
            }

            vertices.push(x, y, z); // Top
            vertices.push(x, 0, z); // Bottom

            if (i < numPoints - 1) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }

        g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        g.setIndex(indices);
        g.computeVertexNormals();

        return g;
    }, [horizontalPoints, gradeIn, gradeOut, curveLength, showProfile]);

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial
                color="#9ca3af"
                side={THREE.DoubleSide}
                transparent
                opacity={0.7}
            />
        </mesh>
    );
};

// Chainage markers
const ChainageMarkers = ({ radius, angle, interval = 20, showMarkers }) => {
    if (!showMarkers) return null;

    const markers = useMemo(() => {
        const angleRad = (angle * Math.PI) / 180;
        const curveLength = radius * angleRad;
        const numMarkers = Math.floor(curveLength / interval);
        const marks = [];

        for (let i = 0; i <= numMarkers; i++) {
            const distance = i * interval;
            const t = distance / radius;
            const x = radius * Math.sin(t);
            const z = -radius * (1 - Math.cos(t));

            marks.push({
                position: [x, 0.1, z],
                label: `${distance}m`
            });
        }

        return marks;
    }, [radius, angle, interval, showMarkers]);

    return (
        <>
            {markers.map((marker, i) => (
                <group key={i} position={marker.position}>
                    <mesh>
                        <cylinderGeometry args={[0.5, 0.5, 2]} />
                        <meshStandardMaterial color="#1f2937" />
                    </mesh>
                    <Text
                        position={[0, 3, 0]}
                        fontSize={2}
                        color="#374151"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {marker.label}
                    </Text>
                </group>
            ))}
        </>
    );
};

// 3D Scene component
const AlignmentScene = ({ params, layers }) => {
    const { radius, angle, gradeIn, gradeOut, curveLength } = params;

    const horizontalPoints = useMemo(() => {
        const angleRad = (angle * Math.PI) / 180;
        const segments = 50;
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * angleRad;
            const x = radius * Math.sin(t);
            const z = -radius * (1 - Math.cos(t));
            points.push([x, 0, z]);
        }

        return points;
    }, [radius, angle]);

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 10, 5]} intensity={0.5} />

            {layers.grid && <GroundPlane size={400} divisions={40} />}

            {layers.centerline && (
                <HorizontalCenterline radius={radius} angle={angle} />
            )}

            {layers.profile && (
                <VerticalProfile
                    horizontalPoints={horizontalPoints}
                    gradeIn={gradeIn}
                    gradeOut={gradeOut}
                    curveLength={curveLength}
                    showProfile={layers.profile}
                />
            )}

            {layers.markers && (
                <ChainageMarkers
                    radius={radius}
                    angle={angle}
                    interval={20}
                    showMarkers={layers.markers}
                />
            )}

            <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={50}
                maxDistance={500}
            />
        </>
    );
};

// Main component
export default function Alignment3DVisualizer() {
    const [params, setParams] = useState({
        radius: 150,
        angle: 60,
        gradeIn: 4,
        gradeOut: -3,
        curveLength: 150
    });

    const [layers, setLayers] = useState({
        grid: true,
        centerline: true,
        profile: true,
        markers: true
    });

    const toggleLayer = (layer) => {
        setLayers({ ...layers, [layer]: !layers[layer] });
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 bg-white">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">3D Alignment Visualization</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Combined Horizontal & Vertical Alignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                            <Label className="text-xs">Radius (m)</Label>
                            <Input
                                type="number"
                                value={params.radius}
                                onChange={(e) => setParams({ ...params, radius: parseFloat(e.target.value) })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Angle (°)</Label>
                            <Input
                                type="number"
                                value={params.angle}
                                onChange={(e) => setParams({ ...params, angle: parseFloat(e.target.value) })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Grade In (%)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={params.gradeIn}
                                onChange={(e) => setParams({ ...params, gradeIn: parseFloat(e.target.value) })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Grade Out (%)</Label>
                            <Input
                                type="number"
                                step="0.1"
                                value={params.gradeOut}
                                onChange={(e) => setParams({ ...params, gradeOut: parseFloat(e.target.value) })}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">V. Curve Len (m)</Label>
                            <Input
                                type="number"
                                value={params.curveLength}
                                onChange={(e) => setParams({ ...params, curveLength: parseFloat(e.target.value) })}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 flex-wrap text-xs py-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={layers.grid} onCheckedChange={() => toggleLayer('grid')} />
                            <span>Ground Grid</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={layers.centerline} onCheckedChange={() => toggleLayer('centerline')} />
                            <span>Centerline</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={layers.profile} onCheckedChange={() => toggleLayer('profile')} />
                            <span>Vertical Profile</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={layers.markers} onCheckedChange={() => toggleLayer('markers')} />
                            <span>Chainage Markers</span>
                        </label>
                    </div>

                    <div className="h-[500px] border border-gray-200 rounded-lg bg-gray-50 overflow-hidden shadow-inner">
                        <Canvas
                            camera={{ position: [100, 80, 150], fov: 50 }}
                            style={{ background: '#ffffff' }}
                        >
                            <AlignmentScene params={params} layers={layers} />
                        </Canvas>
                    </div>

                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p><strong>Controls:</strong> Left-click + drag to rotate | Right-click + drag to pan | Scroll to zoom</p>
                        <p className="mt-1"><strong>View:</strong> 3D perspective with orbit controls | Gray materials for engineering clarity</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}