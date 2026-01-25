import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Point3D {
    x: number;
    y: number;
    z: number;
}

interface Bathymetry3DProps {
    surveyPoints: Point3D[];
    referenceLevel?: number;
    gridSpacing?: number;
    verticalExaggeration?: number;
    showGrid?: boolean;
    showWaterSurface?: boolean;
}

const BathymetryMesh: React.FC<{
    points: Point3D[];
    gridSpacing: number;
    verticalExaggeration: number;
    referenceLevel?: number;
}> = ({ points, gridSpacing, verticalExaggeration, referenceLevel }) => {
    const meshRef = useRef < THREE.Mesh > (null);

    const { geometry, bounds } = useMemo(() => {
        // Calculate bounding box
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const zs = points.map(p => p.z);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const minZ = Math.min(...zs);
        const maxZ = Math.max(...zs);

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const rangeZ = maxZ - minZ || 1;

        // Create grid
        const nx = Math.floor(rangeX / gridSpacing) + 1;
        const ny = Math.floor(rangeY / gridSpacing) + 1;

        // Create geometry
        const geometry = new THREE.PlaneGeometry(rangeX, rangeY, nx - 1, ny - 1);
        const positions = geometry.attributes.position.array as Float32Array;

        // Interpolate Z values using IDW
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i] + minX + rangeX / 2;
            const y = positions[i + 1] + minY + rangeY / 2;

            // Simple IDW interpolation
            let totalWeight = 0;
            let weightedZ = 0;
            const power = 2;
            const searchRadius = gridSpacing * 3;

            for (const pt of points) {
                const dx = pt.x - x;
                const dy = pt.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.001) {
                    // Point coincides
                    weightedZ = pt.z;
                    totalWeight = 1;
                    break;
                } else if (dist <= searchRadius) {
                    const weight = 1 / Math.pow(dist, power);
                    totalWeight += weight;
                    weightedZ += weight * pt.z;
                }
            }

            if (totalWeight > 0) {
                positions[i + 2] = ((weightedZ / totalWeight) - minZ) * verticalExaggeration;
            } else {
                positions[i + 2] = 0;
            }
        }

        geometry.computeVertexNormals();

        return {
            geometry,
            bounds: {
                minX, maxX, minY, maxY, minZ, maxZ,
                rangeX, rangeY, rangeZ,
                centerX: minX + rangeX / 2,
                centerY: minY + rangeY / 2,
                centerZ: minZ + rangeZ / 2
            }
        };
    }, [points, gridSpacing, verticalExaggeration]);

    useFrame(() => {
        if (meshRef.current) {
            // Subtle rotation animation
            meshRef.current.rotation.z += 0.001;
        }
    });

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
        >
            <meshStandardMaterial
                color="#78716c"
                wireframe={false}
                side={THREE.DoubleSide}
                flatShading={false}
            />
        </mesh>
    );
};

const WaterSurface: React.FC<{
    bounds: any;
    level: number;
    verticalExaggeration: number;
}> = ({ bounds, level, verticalExaggeration }) => {
    const waterHeight = (level - bounds.minZ) * verticalExaggeration;

    return (
        <mesh
            position={[0, waterHeight, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
        >
            <planeGeometry args={[bounds.rangeX, bounds.rangeY]} />
            <meshStandardMaterial
                color="#3b82f6"
                transparent
                opacity={0.4}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

export const Bathymetry3D: React.FC<Bathymetry3DProps> = ({
    surveyPoints,
    referenceLevel,
    gridSpacing = 5,
    verticalExaggeration = 1,
    showGrid = true,
    showWaterSurface = true
}) => {
    const [exaggeration, setExaggeration] = useState(verticalExaggeration);

    const bounds = useMemo(() => {
        const xs = surveyPoints.map(p => p.x);
        const ys = surveyPoints.map(p => p.y);
        const zs = surveyPoints.map(p => p.z);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            minZ: Math.min(...zs),
            maxZ: Math.max(...zs),
            rangeX: Math.max(...xs) - Math.min(...xs),
            rangeY: Math.max(...ys) - Math.min(...ys),
            rangeZ: Math.max(...zs) - Math.min(...zs)
        };
    }, [surveyPoints]);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                    Bathymetric Surface (3D)
                </h3>
                <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-600">
                        Vertical Exaggeration: {exaggeration.toFixed(1)}x
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={exaggeration}
                        onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                        className="w-32"
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-200" style={{ height: '600px' }}>
                <Canvas
                    camera={{ position: [bounds.rangeX * 1.5, bounds.rangeZ * exaggeration * 2, bounds.rangeY * 1.5], fov: 50 }}
                >
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={0.8} />
                    <directionalLight position={[-10, -10, -5]} intensity={0.3} />

                    {showGrid && (
                        <Grid
                            args={[bounds.rangeX, bounds.rangeY]}
                            cellSize={gridSpacing}
                            cellThickness={0.5}
                            cellColor="#9ca3af"
                            sectionSize={gridSpacing * 5}
                            sectionThickness={1}
                            sectionColor="#6b7280"
                            fadeDistance={bounds.rangeX * 2}
                            fadeStrength={1}
                            position={[0, -0.01, 0]}
                        />
                    )}

                    <BathymetryMesh
                        points={surveyPoints}
                        gridSpacing={gridSpacing}
                        verticalExaggeration={exaggeration}
                        referenceLevel={referenceLevel}
                    />

                    {showWaterSurface && referenceLevel !== undefined && (
                        <WaterSurface
                            bounds={bounds}
                            level={referenceLevel}
                            verticalExaggeration={exaggeration}
                        />
                    )}

                    <OrbitControls
                        enableDamping
                        dampingFactor={0.05}
                        minDistance={bounds.rangeX * 0.5}
                        maxDistance={bounds.rangeX * 5}
                    />
                </Canvas>
            </div>

            <div className="bg-gray-50 p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">3D Model Info</h4>
                <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                        <div className="text-gray-600">Survey Points</div>
                        <div className="font-semibold text-gray-900">{surveyPoints.length}</div>
                    </div>
                    <div>
                        <div className="text-gray-600">X Range</div>
                        <div className="font-semibold text-gray-900">{bounds.rangeX.toFixed(1)} m</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Y Range</div>
                        <div className="font-semibold text-gray-900">{bounds.rangeY.toFixed(1)} m</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Depth Range</div>
                        <div className="font-semibold text-gray-900">{bounds.rangeZ.toFixed(2)} m</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Grid Spacing</div>
                        <div className="font-semibold text-gray-900">{gridSpacing.toFixed(1)} m</div>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                <strong>Controls:</strong> Left-click and drag to rotate • Right-click and drag to pan • Scroll to zoom
            </div>
        </div>
    );
};