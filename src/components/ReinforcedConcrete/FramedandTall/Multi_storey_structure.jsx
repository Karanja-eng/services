import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Html, Box as DreiBox, Cylinder } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, EyeOff, Layers, TrendingUp, Activity } from 'lucide-react';

// ============================================================================
// 3D COLUMN COMPONENT WITH FORCES
// ============================================================================

const Column3D = ({ element, floorHeight, showForces, showDeflection, selected, onClick }) => {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    const width = element.properties.width;
    const depth = element.properties.depth;
    const height = element.properties.height || floorHeight;

    const x = element.position.x;
    const y = element.position.z || 0; // Floor level
    const z = element.position.y;

    // Color based on forces
    let color = '#888888';
    if (selected) color = '#4CAF50';
    else if (hovered) color = '#FF9800';
    else if (showForces && element.analysisResults) {
        const utilization = element.analysisResults.utilization || 0;
        if (utilization > 1.0) color = '#f44336'; // Over-stressed
        else if (utilization > 0.8) color = '#FF9800'; // High stress
        else if (utilization > 0.5) color = '#FFC107'; // Medium stress
        else color = '#4CAF50'; // Low stress
    }

    return (
        <group position={[x, y + height / 2, z]}>
            <mesh
                ref={meshRef}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(element);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={() => setHovered(false)}
            >
                <boxGeometry args={[width, height, depth]} />
                <meshStandardMaterial
                    color={color}
                    roughness={0.5}
                    metalness={0.2}
                />
            </mesh>

            {/* Edges */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
                <lineBasicMaterial color="#000000" linewidth={1} />
            </lineSegments>

            {/* Label */}
            {(hovered || selected) && (
                <Html position={[0, height / 2 + 0.3, 0]} center>
                    <div style={{
                        background: 'rgba(0,0,0,0.85)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{element.id}</div>
                        {element.analysisResults && (
                            <>
                                <div>N: {element.analysisResults.N?.toFixed(0)} kN</div>
                                <div>M: {element.analysisResults.M?.toFixed(0)} kNm</div>
                                <div>Util: {(element.analysisResults.utilization * 100)?.toFixed(0)}%</div>
                            </>
                        )}
                    </div>
                </Html>
            )}

            {/* Deflection visualization */}
            {showDeflection && element.analysisResults?.deflection && (
                <arrowHelper
                    args={[
                        new THREE.Vector3(
                            element.analysisResults.deflection.x || 0,
                            element.analysisResults.deflection.y || 0,
                            element.analysisResults.deflection.z || 0
                        ).normalize(),
                        new THREE.Vector3(0, 0, 0),
                        Math.min(
                            new THREE.Vector3(
                                element.analysisResults.deflection.x || 0,
                                element.analysisResults.deflection.y || 0,
                                element.analysisResults.deflection.z || 0
                            ).length() * 100,
                            2
                        ),
                        '#ff00ff',
                        0.2,
                        0.2
                    ]}
                />
            )}
        </group>
    );
};

// ============================================================================
// 3D BEAM COMPONENT WITH BM DIAGRAM
// ============================================================================

const Beam3D = ({ element, floorLevel, showDiagrams, selected, onClick }) => {
    const [hovered, setHovered] = useState(false);

    const start = new THREE.Vector3(
        element.position.start.x,
        floorLevel,
        element.position.start.y
    );

    const end = new THREE.Vector3(
        element.position.end.x,
        floorLevel,
        element.position.end.y
    );

    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const width = element.properties.width;
    const depth = element.properties.depth;

    // Rotation to align cylinder with beam direction
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
    );

    let color = '#666666';
    if (selected) color = '#4CAF50';
    else if (hovered) color = '#FF9800';

    // Generate BM diagram points
    const bmCurve = useMemo(() => {
        if (!showDiagrams.moment || !element.analysisResults?.sections) return null;

        const points = [];
        const sections = element.analysisResults.sections;
        const scale = 0.01; // Scale factor for moment diagram

        sections.forEach(section => {
            const t = section.ratio;
            const pos = new THREE.Vector3().lerpVectors(start, end, t);

            // Offset perpendicular to beam
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
            const offset = perpendicular.multiplyScalar((section.Mz || 0) * scale);

            pos.add(offset);
            points.push(pos);
        });

        return points;
    }, [showDiagrams.moment, element.analysisResults, start, end, direction]);

    return (
        <group>
            {/* Main beam */}
            <mesh
                position={center}
                quaternion={quaternion}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(element);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={() => setHovered(false)}
            >
                <cylinderGeometry args={[depth / 2, depth / 2, length, 8]} />
                <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
            </mesh>

            {/* BM diagram */}
            {bmCurve && bmCurve.length > 1 && (
                <Line
                    points={bmCurve}
                    color="#ff0000"
                    lineWidth={3}
                />
            )}

            {/* Label */}
            {(hovered || selected) && (
                <Html position={center} center>
                    <div style={{
                        background: 'rgba(0,0,0,0.85)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        <div style={{ fontWeight: 'bold' }}>{element.id}</div>
                        <div>Length: {length.toFixed(2)} m</div>
                    </div>
                </Html>
            )}
        </group>
    );
};

// ============================================================================
// 3D SLAB COMPONENT
// ============================================================================

const Slab3D = ({ element, floorLevel, opacity, visible, onClick }) => {
    if (!visible) return null;

    const thickness = element.properties.thickness || 0.2;

    return (
        <mesh
            position={[
                element.position.x + element.properties.width / 2,
                floorLevel + thickness / 2,
                element.position.y + element.properties.depth / 2
            ]}
            onClick={(e) => {
                e.stopPropagation();
                onClick(element);
            }}
        >
            <boxGeometry args={[
                element.properties.width,
                thickness,
                element.properties.depth
            ]} />
            <meshStandardMaterial
                color="#cccccc"
                transparent
                opacity={opacity}
                roughness={0.7}
            />
        </mesh>
    );
};

// ============================================================================
// FLOOR LEVEL INDICATOR
// ============================================================================

const FloorLevelIndicator = ({ level, height, label, visible }) => {
    if (!visible) return null;

    return (
        <group position={[0, height, 0]}>
            <mesh position={[-1, 0, 0]}>
                <boxGeometry args={[0.5, 0.05, 0.5]} />
                <meshStandardMaterial color="#2196F3" />
            </mesh>

            <Text
                position={[-2, 0, 0]}
                fontSize={0.3}
                color="#2196F3"
                anchorX="right"
                anchorY="middle"
            >
                {label}
            </Text>

            <Line
                points={[[-1, 0, 0], [0, 0, 0]]}
                color="#2196F3"
                lineWidth={2}
                dashed
                dashScale={2}
            />
        </group>
    );
};

// ============================================================================
// FOUNDATION COMPONENT
// ============================================================================

const Foundation3D = ({ columns, visible }) => {
    if (!visible) return null;

    return (
        <group position={[0, -0.5, 0]}>
            {/* Foundation slab */}
            <mesh>
                <boxGeometry args={[50, 0.5, 50]} />
                <meshStandardMaterial color="#8D6E63" roughness={0.9} />
            </mesh>

            {/* Piles under columns */}
            {columns.map(column => (
                <Cylinder
                    key={`pile-${column.id}`}
                    args={[0.15, 0.15, 2, 16]}
                    position={[column.position.x, -1.25, column.position.y]}
                >
                    <meshStandardMaterial color="#5D4037" />
                </Cylinder>
            ))}
        </group>
    );
};

// ============================================================================
// MAIN 3D VIEWER
// ============================================================================

const Complete3DStructureView = ({
    elements,
    floors = 5,
    floorHeight = 3.5,
    selectedElement,
    onElementClick,
    showDiagrams = { moment: false, shear: false },
    showForces = false,
    showDeflection = false,
    layerVisibility = {}
}) => {
    const [controlsEnabled, setControlsEnabled] = useState(true);
    const [viewMode, setViewMode] = useState('perspective'); // 'perspective', 'plan', 'elevation'
    const [slabOpacity, setSlabOpacity] = useState(0.3);
    const [showFoundation, setShowFoundation] = useState(true);
    const [showFloorLabels, setShowFloorLabels] = useState(true);

    // Group elements by floor
    const elementsByFloor = useMemo(() => {
        const byFloor = {};
        elements.forEach(el => {
            const floor = el.layer || 'Floor 1';
            if (!byFloor[floor]) byFloor[floor] = [];
            byFloor[floor].push(el);
        });
        return byFloor;
    }, [elements]);

    // Calculate scene bounds
    const bounds = useMemo(() => {
        if (elements.length === 0) return { minX: 0, maxX: 30, minZ: 0, maxZ: 30 };

        const xs = [], zs = [];
        elements.forEach(el => {
            if (el.type === 'column') {
                xs.push(el.position.x);
                zs.push(el.position.y);
            } else if (el.type === 'beam') {
                xs.push(el.position.start.x, el.position.end.x);
                zs.push(el.position.start.y, el.position.end.y);
            }
        });

        return {
            minX: Math.min(...xs) - 5,
            maxX: Math.max(...xs) + 5,
            minZ: Math.min(...zs) - 5,
            maxZ: Math.max(...zs) + 5
        };
    }, [elements]);

    const columns = elements.filter(el => el.type === 'column');
    const beams = elements.filter(el => el.type === 'beam');
    const slabs = elements.filter(el => el.type === 'slab');

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Canvas
                camera={{
                    position: [30, 20, 30],
                    fov: 50
                }}
                style={{ background: '#e3f2fd' }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[20, 30, 15]} intensity={1} castShadow />
                <directionalLight position={[-20, 20, -15]} intensity={0.5} />
                <hemisphereLight args={['#ffffff', '#8D6E63', 0.4]} />

                {/* Controls */}
                <OrbitControls
                    enabled={controlsEnabled}
                    enableDamping
                    dampingFactor={0.05}
                    minDistance={5}
                    maxDistance={100}
                />

                {/* Ground plane */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                    <planeGeometry args={[100, 100]} />
                    <meshStandardMaterial color="#A5D6A7" roughness={0.8} />
                </mesh>

                {/* Grid helper */}
                <gridHelper args={[50, 50, '#81C784', '#C8E6C9']} position={[0, 0, 0]} />

                {/* Foundation */}
                <Foundation3D columns={columns} visible={showFoundation} />

                {/* Structural elements by floor */}
                {Array.from({ length: floors }, (_, floorIndex) => {
                    const floorName = `Floor ${floorIndex + 1}`;
                    const floorZ = floorIndex * floorHeight;
                    const isVisible = layerVisibility[floorName] !== false;

                    if (!isVisible) return null;

                    return (
                        <group key={floorName}>
                            {/* Floor level indicator */}
                            <FloorLevelIndicator
                                level={floorIndex}
                                height={floorZ}
                                label={floorName}
                                visible={showFloorLabels}
                            />

                            {/* Columns */}
                            {columns.filter(el => el.layer === floorName).map(column => (
                                <Column3D
                                    key={`${column.id}-${floorIndex}`}
                                    element={column}
                                    floorHeight={floorHeight}
                                    showForces={showForces}
                                    showDeflection={showDeflection}
                                    selected={selectedElement?.id === column.id}
                                    onClick={onElementClick}
                                />
                            ))}

                            {/* Beams */}
                            {beams.filter(el => el.layer === floorName).map(beam => (
                                <Beam3D
                                    key={`${beam.id}-${floorIndex}`}
                                    element={beam}
                                    floorLevel={floorZ + floorHeight}
                                    showDiagrams={showDiagrams}
                                    selected={selectedElement?.id === beam.id}
                                    onClick={onElementClick}
                                />
                            ))}

                            {/* Slabs */}
                            {slabs.filter(el => el.layer === floorName).map(slab => (
                                <Slab3D
                                    key={`${slab.id}-${floorIndex}`}
                                    element={slab}
                                    floorLevel={floorZ + floorHeight}
                                    opacity={slabOpacity}
                                    visible={true}
                                    onClick={onElementClick}
                                />
                            ))}
                        </group>
                    );
                })}

                {/* Axes helper */}
                <axesHelper args={[5]} />
            </Canvas>

            {/* View controls overlay */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                minWidth: '200px'
            }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
                    3D View Options
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}>
                        <span>Slab Opacity</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={slabOpacity}
                            onChange={(e) => setSlabOpacity(Number(e.target.value))}
                            style={{ width: '100px' }}
                        />
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="checkbox"
                            checked={showFoundation}
                            onChange={(e) => setShowFoundation(e.target.checked)}
                        />
                        Show Foundation
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="checkbox"
                            checked={showFloorLabels}
                            onChange={(e) => setShowFloorLabels(e.target.checked)}
                        />
                        Show Floor Labels
                    </label>
                </div>
            </div>

            {/* Legend */}
            {showForces && (
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                        Utilization
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '20px', height: '12px', background: '#4CAF50', borderRadius: '2px' }} />
                            <span>&lt; 50%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '20px', height: '12px', background: '#FFC107', borderRadius: '2px' }} />
                            <span>50-80%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '20px', height: '12px', background: '#FF9800', borderRadius: '2px' }} />
                            <span>80-100%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '20px', height: '12px', background: '#f44336', borderRadius: '2px' }} />
                            <span>&gt; 100%</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Complete3DStructureView;