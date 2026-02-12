import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Html, Box as DreiBox, Cylinder } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, EyeOff, Layers, TrendingUp, Activity } from 'lucide-react';

// ============================================================================
// 3D COLUMN COMPONENT WITH FORCES
// ============================================================================

const Column3D = ({
    element,
    floorHeight,
    showForces,
    showDeflection,
    selected,
    onClick,
    showDiagrams = { moment: false, shear: false },
    showLabels = true,
    diagramScale = 0.002,
    wireframe = false,
    sectionDisplayType = 'rectangle'
}) => {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    const height = element.properties.height || floorHeight;

    // diagrams
    const bmCurve = useMemo(() => {
        if (!showDiagrams.moment || !element.analysisResults?.sections) return null;
        return element.analysisResults.sections.map(s => [
            s.ratio * 0, // Simplified for column verticality
            s.ratio * height - height / 2,
            s.Mz * diagramScale
        ]);
    }, [element.analysisResults, showDiagrams.moment, height, diagramScale]);

    const sfCurve = useMemo(() => {
        if (!showDiagrams.shear || !element.analysisResults?.sections) return null;
        return element.analysisResults.sections.map(s => [
            s.Vy * diagramScale,
            s.ratio * height - height / 2,
            0
        ]);
    }, [element.analysisResults, showDiagrams.shear, height, diagramScale]);

    const width = element.properties.width;
    const depth = element.properties.depth;

    const x = element.position.x;
    const y = element.position.z || 0;
    const z = element.position.y;

    let color = '#888888';
    if (selected) color = '#4CAF50';
    else if (hovered) color = '#FF9800';
    else if (showForces && element.analysisResults) {
        const utilization = element.analysisResults.utilization || 0;
        if (utilization > 1.0) color = '#f44336';
        else if (utilization > 0.8) color = '#FF9800';
        else if (utilization > 0.5) color = '#FFC107';
        else color = '#4CAF50';
    }

    // Proportions for steel sections
    const sWidth = width; // Plan X
    const sDepth = depth; // Plan Z
    const flangeThickness = sDepth / 10;
    const webThickness = sWidth / 15;

    const renderColumnCore = () => {
        if (sectionDisplayType === 'I-section') {
            return (
                <group>
                    {/* Flanges are along Z (sDepth), Web is along X (sWidth) */}
                    {/* Left Flange (Z-) */}
                    <mesh position={[0, 0, -sDepth / 2 + flangeThickness / 2]}>
                        <boxGeometry args={[sWidth, height, flangeThickness]} />
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </mesh>
                    {/* Web - spans along X (sWidth) */}
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[webThickness, height, sDepth - 2 * flangeThickness]} />
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </mesh>
                    {/* Right Flange (Z+) */}
                    <mesh position={[0, 0, sDepth / 2 - flangeThickness / 2]}>
                        <boxGeometry args={[sWidth, height, flangeThickness]} />
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </mesh>
                </group>
            );
        } else if (sectionDisplayType === 'circle') {
            return (
                <Cylinder args={[Math.max(sWidth, sDepth) / 2, Math.max(sWidth, sDepth) / 2, height, 16]}>
                    <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                </Cylinder>
            );
        } else {
            return (
                <mesh
                    ref={meshRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick(element);
                    }}
                >
                    <boxGeometry args={[width, height, depth]} />
                    <meshStandardMaterial
                        color={color}
                        roughness={0.5}
                        metalness={0.2}
                        wireframe={wireframe}
                    />
                </mesh>
            );
        }
    };

    return (
        <group
            position={[x, y + height / 2, z]}
            onClick={(e) => {
                if (sectionDisplayType !== 'rectangle') {
                    e.stopPropagation();
                    onClick(element);
                }
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
        >
            {renderColumnCore()}

            {/* Edges - Only for rectangle to keep it clean, or adapt for others */}
            {sectionDisplayType === 'rectangle' && (
                <lineSegments>
                    <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
                    <lineBasicMaterial color="#000000" linewidth={1} />
                </lineSegments>
            )}

            {/* Label */}
            {(showLabels || hovered || selected) && (
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
                                <div>N: {element.analysisResults.N_max?.toFixed(0)} kN</div>
                                <div>M: {element.analysisResults.M_max?.toFixed(0)} kNm</div>
                                <div>Util: {(element.analysisResults.utilization * 100)?.toFixed(0)}%</div>
                            </>
                        )}
                    </div>
                </Html>
            )}

            {/* diagrams/deflection omitted for brevity but should be kept in real implementation if possible. 
                Wait, I should not omit them if I'm replacing the whole block. I will include them. */}
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

            {/* Column BM diagram */}
            {bmCurve && bmCurve.length > 1 && (
                <Line
                    points={bmCurve}
                    color="#ff0000"
                    lineWidth={2}
                />
            )}

            {/* Column SF diagram */}
            {sfCurve && sfCurve.length > 1 && (
                <Line
                    points={sfCurve}
                    color="#0000ff"
                    lineWidth={2}
                />
            )}
        </group>
    );
};

// ============================================================================
// 3D BEAM COMPONENT WITH BM DIAGRAM
// ============================================================================

const Beam3D = ({
    element,
    floorLevel,
    showDiagrams,
    selected,
    onClick,
    showLabels = true,
    diagramScale = 0.002,
    wireframe = false,
    sectionDisplayType = 'rectangle'
}) => {
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


    const bmCurve = useMemo(() => {
        if (!showDiagrams.moment || !element.analysisResults?.sections) return null;
        return element.analysisResults.sections.map(s => {
            const t = s.ratio;
            const pos = new THREE.Vector3().lerpVectors(start, end, t).sub(center);
            const offset = new THREE.Vector3(0, s.Mz * diagramScale, 0); // Vertical offset for beam BM
            return pos.add(offset);
        });
    }, [element.analysisResults, showDiagrams.moment, start, end, center, diagramScale]);

    const sfCurve = useMemo(() => {
        if (!showDiagrams.shear || !element.analysisResults?.sections) return null;
        return element.analysisResults.sections.map(s => {
            const t = s.ratio;
            const pos = new THREE.Vector3().lerpVectors(start, end, t).sub(center);
            const offset = new THREE.Vector3(0, s.Vy * diagramScale, 0);
            return pos.add(offset);
        });
    }, [element.analysisResults, showDiagrams.shear, start, end, center, diagramScale]);

    /**
     * BEAM ORIENTATION LOGIC
     * We want the beam's "depth" (height) to be vertical (along Global Y).
     * The quaternion rotates Local Y (beam axis) to the direction vector.
     * To keep it upright, we calculate the horizontal angle and rotate around Y,
     * then handle any slope.
     */
    const angleY = Math.atan2(direction.x, direction.z);
    const slope = Math.asin(direction.y / length);

    // Construct rotation: first rotate to face direction in XZ plane, then tilt for slope
    const rotation = new THREE.Euler(
        -Math.PI / 2 + slope, // tilt up/down (and compensate for initial Y-up cylinder/box)
        angleY,               // rotate around Y axis
        0,                    // no roll
        'YXZ'
    );

    let color = '#666666';
    if (selected) color = '#4CAF50';
    else if (hovered) color = '#FF9800';

    const renderBeamCore = () => {
        // In this rotation setup (Euler), Local Y is along beam, Local Z is vertical, Local X is horizontal
        // Width is along Local X, Depth is along Local Z, Length is along Local Y
        if (sectionDisplayType === 'I-section') {
            const flangeThickness = depth / 10;
            const webThickness = width / 15;
            return (
                <group rotation={rotation}>
                    {/* Top Flange (Local Z+) */}
                    <mesh position={[0, 0, depth / 2 - flangeThickness / 2]}>
                        <boxGeometry args={[width, length, flangeThickness]} />
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </mesh>
                    {/* Web (Center) */}
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[webThickness, length, depth - 2 * flangeThickness]} />
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </mesh>
                    {/* Bottom Flange (Local Z-) */}
                    <mesh position={[0, 0, -depth / 2 + flangeThickness / 2]}>
                        <boxGeometry args={[width, length, flangeThickness]} />
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </mesh>
                </group>
            );
        } else if (sectionDisplayType === 'circle') {
            return (
                <group rotation={rotation}>
                    <Cylinder args={[Math.max(width, depth) / 2, Math.max(width, depth) / 2, length, 16]}>
                        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                    </Cylinder>
                </group>
            );
        } else {
            return (
                <mesh
                    rotation={rotation}
                >
                    <boxGeometry args={[width, length, depth]} />
                    <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} wireframe={wireframe} />
                </mesh>
            );
        }
    };

    return (
        <group
            position={center}
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
            {renderBeamCore()}

            {/* Beam Edges - Only for rectangle */}
            {sectionDisplayType === 'rectangle' && (
                <group rotation={rotation}>
                    <lineSegments>
                        <edgesGeometry args={[new THREE.BoxGeometry(width, length, depth)]} />
                        <lineBasicMaterial color="#000000" linewidth={1} />
                    </lineSegments>
                </group>
            )}

            {/* BM diagram */}
            {bmCurve && (
                <Line
                    points={bmCurve}
                    color="#ff0000"
                    lineWidth={2}
                />
            )}

            {/* SF diagram */}
            {sfCurve && (
                <Line
                    points={sfCurve}
                    color="#0000ff"
                    lineWidth={2}
                />
            )}

            {/* Label */}
            {(showLabels || hovered || selected) && (
                <Html position={[0, 0, 0]} center>
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

const Slab3D = ({ element, floorLevel, opacity, visible = true, onClick, wireframe = false }) => {
    if (!visible) return null;

    const thickness = element.properties.thickness || 0.2;
    console.log(`Slab3D [${element.id}] Opacity:`, opacity);

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
                key={`mat-${opacity}-${wireframe}`}
                color="#cccccc"
                transparent={true}
                depthWrite={true}
                opacity={opacity}
                roughness={0.7}
                side={THREE.DoubleSide}
                wireframe={wireframe}
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

const Foundation3D = ({ columns, visible, opacity = 1.0 }) => {
    if (!visible) return null;

    return (
        <group position={[0, -0.5, 0]}>
            {/* Foundation bed / Site soil */}
            <mesh receiveShadow>
                <boxGeometry args={[100, 0.5, 100]} />
                <meshStandardMaterial
                    color="#8D6E63"
                    roughness={0.9}
                    transparent={true}
                    opacity={opacity}
                />
            </mesh>

            {/* Piles under columns (Base floor only) */}
            {columns.filter(c => c.layer === 'Floor 1' || c.position.z === 0).map(column => (
                <Cylinder
                    key={`pile-${column.id}`}
                    args={[0.15, 0.15, 2, 16]}
                    position={[column.position.x, -1.25, column.position.y]}
                >
                    <meshStandardMaterial
                        color="#5D4037"
                        transparent={true}
                        opacity={Math.max(opacity, 0.3)} // Keep piles more visible
                    />
                </Cylinder>
            ))}
        </group>
    );
};

// ============================================================================
// MAIN 3D VIEWER
// ============================================================================

// ============================================================================
// STRUCTURAL GRID COMPONENT (3D)
// ============================================================================

const StructuralGrid3D = ({ size = 100, spacing = 5, visible = true }) => {
    if (!visible) return null;

    const lines = [];
    const labels = [];
    const halfSize = size / 2;

    // Grid lines and labels
    for (let i = -halfSize; i <= halfSize; i += spacing) {
        // Vertical grid lines (Parallel to Z axis, spaced along X)
        lines.push(
            <Line
                key={`v-${i}`}
                points={[i, 0, -halfSize, i, 0, halfSize]}
                color="#000000"
                lineWidth={0.5}
                transparent
                opacity={0.2}
            />
        );

        // Horizontal grid lines (Parallel to X axis, spaced along Z)
        lines.push(
            <Line
                key={`h-${i}`}
                points={[-halfSize, 0, i, halfSize, 0, i]}
                color="#000000"
                lineWidth={0.5}
                transparent
                opacity={0.2}
            />
        );

        // Labels (X-axis labels: 1, 2, 3...)
        // We only label positive and zero coordinates to match 2D origin at 0,0
        if (i >= 0) {
            const indexX = Math.floor(i / spacing) + 1;
            labels.push(
                <Text
                    key={`label-x-${i}`}
                    position={[i, 0.1, -2]}
                    fontSize={2}
                    color="#000000"
                    rotation={[-Math.PI / 2, 0, 0]}
                    anchorX="center"
                    anchorY="middle"
                >
                    {indexX}
                </Text>
            );

            const indexY = String.fromCharCode(65 + Math.floor(i / spacing));
            labels.push(
                <Text
                    key={`label-y-${i}`}
                    position={[-2, 0.1, i]}
                    fontSize={2}
                    color="#000000"
                    rotation={[-Math.PI / 2, 0, 0]}
                    anchorX="center"
                    anchorY="middle"
                >
                    {indexY}
                </Text>
            );
        }
    }

    return (
        <group>
            {lines}
            {labels}
        </group>
    );
};

// ============================================================================
// 3D WALL COMPONENT
// ============================================================================

const Wall3D = ({ element, floorLevel, floorHeight, opacity = 1, selected, onClick, showLabels = true, wireframe = false, diagramScale = 25, sectionDisplayType = 'rectangle' }) => {
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
    const height = element.properties.height || floorHeight;
    const thickness = element.properties.thickness || 0.20;

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        direction.clone().normalize()
    );

    let color = '#a0a0a0'; // Grey for walls
    if (selected) color = '#4CAF50';
    else if (hovered) color = '#FF9800';

    return (
        <group>
            <mesh
                position={[center.x, floorLevel + height / 2, center.z]}
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
                <boxGeometry args={[thickness, height, length]} />
                <meshStandardMaterial
                    color={color}
                    transparent={opacity < 1}
                    opacity={opacity}
                    roughness={0.5}
                    wireframe={wireframe}
                />
            </mesh>

            {/* Edge highlights */}
            <group position={[center.x, floorLevel + height / 2, center.z]} quaternion={quaternion}>
                <lineSegments>
                    <edgesGeometry args={[new THREE.BoxGeometry(thickness, height, length)]} />
                    <lineBasicMaterial color="#000000" linewidth={1} />
                </lineSegments>
            </group>

            {/* Label */}
            {(showLabels || hovered || selected) && (
                <Html position={[center.x, floorLevel + height + 0.5, center.z]} center>
                    <div style={{
                        background: 'rgba(0,0,0,0.85)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        {element.id}
                    </div>
                </Html>
            )}
        </group>
    );
};

// ============================================================================
// STRUCTURAL SCENE COMPONENTS
// ============================================================================

export const StructureScene = ({
    elements,
    floors = 5,
    floorHeight = 3.5,
    selectedElement,
    onElementClick,
    showDiagrams = { moment: false, shear: false },
    showForces = false,
    showDeflection = false,
    floorVisibility = {},
    layerVisibility = { columns: true, beams: true, slabs: true, gridLines: true, voids: true, labels: true },
    slabOpacity = 0.4,
    groundOpacity = 1.0,
    showGrid = true,
    showFoundation = true,
    showFloorLabels = true,
    diagramScale = 25,
    // Universal props from StructuralVisualizationComponent
    showConcrete = true,
    showRebar = true,
    showDimensions = true,
    wireframe = false,
    sectionDisplayType = 'rectangle'
}) => {
    const columns = elements.filter(el => el.type === 'column');
    const beams = elements.filter(el => el.type === 'beam');
    const slabs = elements.filter(el => el.type === 'slab');
    const walls = elements.filter(el => el.type === 'wall');
    const voids = elements.filter(el => el.type === 'void');

    // Merge universal toggles with layer visibility
    const activeLayerVisibility = useMemo(() => ({
        ...layerVisibility,
        columns: layerVisibility.columns && showConcrete,
        beams: layerVisibility.beams && showConcrete,
        slabs: layerVisibility.slabs && showConcrete,
        walls: layerVisibility.walls && showConcrete,
        labels: layerVisibility.labels && showDimensions,
        gridLines: layerVisibility.gridLines && showGrid
    }), [layerVisibility, showConcrete, showDimensions, showGrid]);

    // Calculate a better diagram scale based on building max moment
    const effectiveScale = useMemo(() => {
        let maxM = 0;
        elements.forEach(el => {
            const m = Math.abs(el.analysisResults?.M_max || 0);
            if (m > maxM) maxM = m;
        });
        if (maxM < 0.01) return 0.1;
        return (0.8 / maxM) * (diagramScale / 25);
    }, [elements, diagramScale]);

    return (
        <group>
            {/* Ground plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial
                    color="#f5f5f5"
                    roughness={0.8}
                    transparent={true}
                    opacity={groundOpacity}
                />
            </mesh>

            {/* Grid */}
            <StructuralGrid3D size={100} spacing={5} visible={activeLayerVisibility.gridLines} />

            {/* Foundation */}
            <Foundation3D columns={columns} visible={showFoundation} opacity={groundOpacity} />

            {/* Structural elements by floor */}
            {Array.from({ length: floors }, (_, floorIndex) => {
                const floorName = `Floor ${floorIndex + 1}`;
                const floorZ = floorIndex * floorHeight;
                const isVisible = floorVisibility[floorName] !== false;

                if (!isVisible) return null;

                return (
                    <group key={floorName}>
                        <FloorLevelIndicator
                            level={floorIndex}
                            height={floorZ}
                            label={floorName}
                            visible={showFloorLabels}
                        />

                        {activeLayerVisibility.columns && columns.filter(el => el.layer === floorName).map(column => (
                            <Column3D
                                key={column.id}
                                element={column}
                                floorHeight={floorHeight}
                                showForces={showForces}
                                showDeflection={showDeflection}
                                showDiagrams={showDiagrams}
                                diagramScale={effectiveScale}
                                onClick={onElementClick}
                                showLabels={activeLayerVisibility.labels}
                                wireframe={wireframe}
                                sectionDisplayType={sectionDisplayType}
                            />
                        ))}

                        {activeLayerVisibility.beams && beams.filter(el => el.layer === floorName).map(beam => (
                            <Beam3D
                                key={`${beam.id}-${floorIndex}`}
                                element={beam}
                                floorLevel={floorZ + floorHeight}
                                showDiagrams={showDiagrams}
                                diagramScale={effectiveScale}
                                onClick={onElementClick}
                                showLabels={activeLayerVisibility.labels}
                                wireframe={wireframe}
                                sectionDisplayType={sectionDisplayType}
                            />
                        ))}

                        {activeLayerVisibility.slabs && slabs.filter(el => el.layer === floorName).map(slab => (
                            <Slab3D
                                key={slab.id}
                                element={slab}
                                floorLevel={floorZ + floorHeight}
                                opacity={slabOpacity}
                                visible={!voids.some(v => v.layer === floorName && v.id === `void-${slab.id}`)}
                                selected={selectedElement?.id === slab.id}
                                onClick={onElementClick}
                                wireframe={wireframe}
                            />
                        ))}

                        {activeLayerVisibility.walls && walls.filter(el => el.layer === floorName).map(wall => (
                            <Wall3D
                                key={wall.id}
                                element={wall}
                                floorLevel={floorZ}
                                floorHeight={floorHeight}
                                opacity={1.0}
                                selected={selectedElement?.id === wall.id}
                                onClick={onElementClick}
                                showLabels={activeLayerVisibility.labels}
                                wireframe={wireframe}
                            />
                        ))}
                    </group>
                );
            })}

            <axesHelper args={[5]} />
        </group>
    );
};

const Complete3DStructureView = ({
    elements,
    floors = 5,
    floorHeight = 3.5,
    selectedElement,
    onElementClick,
    showDiagrams = { moment: false, shear: false },
    showForces = false,
    showDeflection = false,
    floorVisibility = {},
    layerVisibility = {},
    groundOpacity = 1.0,
    setGroundOpacity,
    slabOpacity = 0.4,
    setSlabOpacity,
    sectionDisplayType = 'rectangle'
}) => {
    const [controlsEnabled, setControlsEnabled] = useState(true);
    const [showFoundation, setShowFoundation] = useState(true);
    const [showFloorLabels, setShowFloorLabels] = useState(true);

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

                <StructureScene
                    elements={elements}
                    floors={floors}
                    floorHeight={floorHeight}
                    selectedElement={selectedElement}
                    onElementClick={onElementClick}
                    showDiagrams={showDiagrams}
                    showForces={showForces}
                    showDeflection={showDeflection}
                    floorVisibility={floorVisibility}
                    layerVisibility={layerVisibility}
                    slabOpacity={slabOpacity}
                    groundOpacity={groundOpacity}
                    showFoundation={showFoundation}
                    showFloorLabels={showFloorLabels}
                />
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
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}>
                        <span>Ground Opacity</span>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={groundOpacity}
                            onChange={(e) => setGroundOpacity(Number(e.target.value))}
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