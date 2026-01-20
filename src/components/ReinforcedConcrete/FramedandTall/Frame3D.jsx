import React, { useState, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// MEMBER COMPONENT WITH BM/SF DIAGRAMS
// ============================================================================

const Member3D = ({ member, nodes, showDeformed, deformationScale, showDiagrams, selectedMember, onSelect }) => {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    const startNode = nodes.find(n => n.id === member.startNode);
    const endNode = nodes.find(n => n.id === member.endNode);

    // Generate BM diagram points (must be before early return)
    const bmPoints = useMemo(() => {
        if (!startNode || !endNode || !showDiagrams.moment) return null;

        const start = showDeformed
            ? new THREE.Vector3(startNode.displaced_x, startNode.displaced_y, startNode.displaced_z)
            : new THREE.Vector3(startNode.x, startNode.y, startNode.z);

        const end = showDeformed
            ? new THREE.Vector3(endNode.displaced_x, endNode.displaced_y, endNode.displaced_z)
            : new THREE.Vector3(endNode.x, endNode.y, endNode.z);

        const direction = new THREE.Vector3().subVectors(end, start);

        const points = [];
        const scale = 0.01;

        member.sections.forEach(section => {
            const t = section.ratio;
            const pos = new THREE.Vector3().lerpVectors(start, end, t);

            const up = new THREE.Vector3(0, 0, 1);
            const localZ = new THREE.Vector3().crossVectors(direction, up).normalize();
            if (localZ.length() < 0.01) {
                localZ.set(1, 0, 0);
            }

            const offset = localZ.multiplyScalar(section.Mz * scale);
            pos.add(offset);
            points.push(pos);
        });

        return points;
    }, [member.sections, showDiagrams.moment, showDeformed, startNode, endNode]);

    // Generate SF diagram points (must be before early return)
    const sfPoints = useMemo(() => {
        if (!startNode || !endNode || !showDiagrams.shear) return null;

        const start = showDeformed
            ? new THREE.Vector3(startNode.displaced_x, startNode.displaced_y, startNode.displaced_z)
            : new THREE.Vector3(startNode.x, startNode.y, startNode.z);

        const end = showDeformed
            ? new THREE.Vector3(endNode.displaced_x, endNode.displaced_y, endNode.displaced_z)
            : new THREE.Vector3(endNode.x, endNode.y, endNode.z);

        const direction = new THREE.Vector3().subVectors(end, start);

        const points = [];
        const scale = 0.02;

        member.sections.forEach(section => {
            const t = section.ratio;
            const pos = new THREE.Vector3().lerpVectors(start, end, t);

            const up = new THREE.Vector3(0, 0, 1);
            const localZ = new THREE.Vector3().crossVectors(direction, up).normalize();
            if (localZ.length() < 0.01) {
                localZ.set(1, 0, 0);
            }

            const offset = localZ.multiplyScalar(section.Vy * scale);
            pos.add(offset);
            points.push(pos);
        });

        return points;
    }, [member.sections, showDiagrams.shear, showDeformed, startNode, endNode]);

    if (!startNode || !endNode) return null;

    // Calculate member geometry
    const start = showDeformed
        ? new THREE.Vector3(startNode.displaced_x, startNode.displaced_y, startNode.displaced_z)
        : new THREE.Vector3(startNode.x, startNode.y, startNode.z);

    const end = showDeformed
        ? new THREE.Vector3(endNode.displaced_x, endNode.displaced_y, endNode.displaced_z)
        : new THREE.Vector3(endNode.x, endNode.y, endNode.z);

    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // Member orientation
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
    );

    // Section dimensions (convert mm to m, scale for visibility)
    const width = (member.section.width || 400) / 1000;
    const depth = (member.section.depth || 600) / 1000;

    // Color based on forces
    const maxMoment = Math.max(...member.sections.map(s => Math.abs(s.Mz)));
    const color = selectedMember === member.id
        ? '#00ff00'
        : (hovered ? '#ffaa00' : '#888888');

    return (
        <group>
            {/* Member solid */}
            <mesh
                ref={meshRef}
                position={center}
                quaternion={quaternion}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(member.id);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHovered(true);
                }}
                onPointerOut={() => setHovered(false)}
            >
                <boxGeometry args={[width, length, depth]} />
                <meshStandardMaterial
                    color={color}
                    roughness={0.5}
                    metalness={0.1}
                />
            </mesh>

            {/* Member edges */}
            <lineSegments position={center} quaternion={quaternion}>
                <edgesGeometry args={[new THREE.BoxGeometry(width, length, depth)]} />
                <lineBasicMaterial color="#000000" linewidth={1} />
            </lineSegments>

            {/* Bending moment diagram */}
            {bmPoints && (
                <>
                    <Line
                        points={bmPoints}
                        color="#ff0000"
                        lineWidth={2}
                    />
                    {/* Fill area */}
                    <mesh>
                        <shapeGeometry args={[createShapeFromPoints(bmPoints, start, end)]} />
                        <meshBasicMaterial color="#ff0000" transparent opacity={0.3} side={THREE.DoubleSide} />
                    </mesh>
                </>
            )}

            {/* Shear force diagram */}
            {sfPoints && (
                <Line
                    points={sfPoints}
                    color="#0000ff"
                    lineWidth={2}
                />
            )}

            {/* Hover label */}
            {hovered && (
                <Html position={center}>
                    <div style={{
                        background: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        <div><b>Member {member.id}</b></div>
                        <div>Length: {length.toFixed(2)} m</div>
                        <div>Max M: {maxMoment.toFixed(1)} kNm</div>
                        <div>Click for details</div>
                    </div>
                </Html>
            )}
        </group>
    );
};

// Helper function to create shape for moment diagram fill
const createShapeFromPoints = (points, start, end) => {
    const shape = new THREE.Shape();

    if (points.length < 2) return shape;

    // Start at member start
    shape.moveTo(start.x, start.y);

    // Follow moment diagram
    points.forEach(p => {
        shape.lineTo(p.x, p.y);
    });

    // Return to member end
    shape.lineTo(end.x, end.y);

    // Close shape
    shape.lineTo(start.x, start.y);

    return shape;
};

// ============================================================================
// NODE/SUPPORT COMPONENT
// ============================================================================

const Node3D = ({ node, showDeformed, deformationScale }) => {
    const [hovered, setHovered] = useState(false);

    const position = showDeformed
        ? [node.displaced_x, node.displaced_y, node.displaced_z]
        : [node.x, node.y, node.z];

    const hasSupport = Object.values(node.support || {}).some(v => v === true);

    return (
        <group position={position}>
            {/* Node sphere */}
            <mesh
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial
                    color={hasSupport ? '#ff0000' : '#00ff00'}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>

            {/* Support symbol */}
            {hasSupport && (
                <group>
                    {/* Triangle for pinned/fixed support */}
                    <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.3, 0]}>
                        <coneGeometry args={[0.3, 0.4, 3]} />
                        <meshStandardMaterial color="#666666" />
                    </mesh>

                    {/* Ground hatching */}
                    {[0, 1, 2, 3, 4].map(i => (
                        <Line
                            key={i}
                            points={[
                                [-0.5 + i * 0.25, -0.7, 0],
                                [-0.35 + i * 0.25, -0.9, 0]
                            ]}
                            color="#333333"
                            lineWidth={2}
                        />
                    ))}
                </group>
            )}

            {/* Node label */}
            <Text
                position={[0, 0.5, 0]}
                fontSize={0.2}
                color="#000000"
                anchorX="center"
                anchorY="middle"
            >
                {node.id}
            </Text>

            {/* Displacement arrows */}
            {showDeformed && node.displacement && (
                <group>
                    {Math.abs(node.displacement.dy) > 0.001 && (
                        <arrowHelper
                            args={[
                                new THREE.Vector3(0, Math.sign(node.displacement.dy), 0),
                                new THREE.Vector3(0, 0, 0),
                                Math.abs(node.displacement.dy) * deformationScale * 0.5,
                                '#ff00ff',
                                0.1,
                                0.1
                            ]}
                        />
                    )}
                </group>
            )}

            {/* Hover info */}
            {hovered && node.displacement && (
                <Html>
                    <div style={{
                        background: 'rgba(0,0,0,0.9)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        minWidth: '150px'
                    }}>
                        <div><b>Node {node.id}</b></div>
                        <div>Position: ({node.x.toFixed(2)}, {node.y.toFixed(2)}, {node.z.toFixed(2)})</div>
                        {node.displacement && (
                            <>
                                <div style={{ marginTop: '4px', borderTop: '1px solid #555', paddingTop: '4px' }}>
                                    <b>Displacements:</b>
                                </div>
                                <div>dx: {node.displacement.dx.toFixed(2)} mm</div>
                                <div>dy: {node.displacement.dy.toFixed(2)} mm</div>
                                <div>dz: {node.displacement.dz.toFixed(2)} mm</div>
                            </>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
};

// ============================================================================
// LOAD VISUALIZATION
// ============================================================================

const Loads3D = ({ loads, members, nodes }) => {
    return (
        <group>
            {loads && loads.map((load, idx) => {
                if (load.member_id) {
                    const member = members.find(m => m.id === load.member_id);
                    if (!member) return null;

                    const startNode = nodes.find(n => n.id === member.startNode);
                    const endNode = nodes.find(n => n.id === member.endNode);
                    if (!startNode || !endNode) return null;

                    // Draw distributed load arrows
                    const nArrows = 5;
                    return (
                        <group key={idx}>
                            {[...Array(nArrows)].map((_, i) => {
                                const t = i / (nArrows - 1);
                                const x = startNode.x + t * (endNode.x - startNode.x);
                                const y = startNode.y + t * (endNode.y - startNode.y);
                                const z = startNode.z + t * (endNode.z - startNode.z);

                                return (
                                    <group key={i} position={[x, y + 0.5, z]}>
                                        <arrowHelper
                                            args={[
                                                new THREE.Vector3(0, -1, 0),
                                                new THREE.Vector3(0, 0, 0),
                                                0.5,
                                                '#ffff00',
                                                0.1,
                                                0.1
                                            ]}
                                        />
                                    </group>
                                );
                            })}
                        </group>
                    );
                }
                return null;
            })}
        </group>
    );
};

// ============================================================================
// MAIN FRAME3D COMPONENT
// ============================================================================

const Frame3D = ({ data, showDeformed, deformationScale, showDiagrams, onMemberSelect }) => {
    const [selectedMember, setSelectedMember] = useState(null);

    // Calculate scene bounds for camera positioning (must be before early return)
    const bounds = useMemo(() => {
        if (!data || !data.nodes || !data.members) {
            return {
                minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10,
                centerX: 5, centerY: 5, centerZ: 5
            };
        }
        const xs = data.nodes.map(n => n.x);
        const ys = data.nodes.map(n => n.y);
        const zs = data.nodes.map(n => n.z);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            minZ: Math.min(...zs),
            maxZ: Math.max(...zs),
            centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
            centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
            centerZ: (Math.min(...zs) + Math.max(...zs)) / 2
        };
    }, [data]);

    if (!data || !data.nodes || !data.members) {
        return (
            <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1a1a1a',
                color: 'white'
            }}>
                <div>
                    <div style={{ fontSize: '18px', marginBottom: '8px' }}>No Data</div>
                    <div style={{ fontSize: '14px', opacity: 0.7 }}>Load frame analysis results to view</div>
                </div>
            </div>
        );
    }

    const handleMemberSelect = (memberId) => {
        setSelectedMember(memberId);
        if (onMemberSelect) {
            onMemberSelect(memberId);
        }
    };

    const cameraDistance = Math.max(
        bounds.maxX - bounds.minX,
        bounds.maxY - bounds.minY,
        bounds.maxZ - bounds.minZ
    ) * 2;

    return (
        <Canvas
            camera={{
                position: [cameraDistance, cameraDistance, cameraDistance],
                fov: 50
            }}
            style={{ background: '#f0f0f0' }}
        >
            <Suspense fallback={null}>
                {/* Lighting */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
                <directionalLight position={[-10, -10, -5]} intensity={0.4} />
                <pointLight position={[0, 20, 0]} intensity={0.5} />

                {/* Controls */}
                <OrbitControls
                    target={[bounds.centerX, bounds.centerY, bounds.centerZ]}
                    enableDamping
                    dampingFactor={0.05}
                />

                {/* Grid */}
                <gridHelper
                    args={[50, 50, '#cccccc', '#dddddd']}
                    position={[0, Math.min(...data.nodes.map(n => n.y)) - 0.5, 0]}
                />

                {/* Axes */}
                <axesHelper args={[5]} />

                {/* Nodes */}
                {data.nodes.map(node => (
                    <Node3D
                        key={node.id}
                        node={node}
                        showDeformed={showDeformed}
                        deformationScale={deformationScale}
                    />
                ))}

                {/* Members */}
                {data.members.map(member => (
                    <Member3D
                        key={member.id}
                        member={member}
                        nodes={data.nodes}
                        showDeformed={showDeformed}
                        deformationScale={deformationScale}
                        showDiagrams={showDiagrams}
                        selectedMember={selectedMember}
                        onSelect={handleMemberSelect}
                    />
                ))}

                {/* Loads */}
                {data.loads && (
                    <Loads3D
                        loads={data.loads}
                        members={data.members}
                        nodes={data.nodes}
                    />
                )}

                {/* Legend */}
                <Html fullscreen>
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'rgba(255,255,255,0.9)',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        minWidth: '200px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                            {data.combination || 'Load Combination'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ width: '20px', height: '3px', background: '#ff0000', marginRight: '8px' }} />
                            <span>Bending Moment</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ width: '20px', height: '3px', background: '#0000ff', marginRight: '8px' }} />
                            <span>Shear Force</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ width: '12px', height: '12px', background: '#ff0000', borderRadius: '50%', marginRight: '8px' }} />
                            <span>Supports</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '12px', height: '12px', background: '#00ff00', borderRadius: '50%', marginRight: '8px' }} />
                            <span>Free Nodes</span>
                        </div>
                        {showDeformed && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ccc' }}>
                                <div>Deformation Scale: {deformationScale}x</div>
                            </div>
                        )}
                    </div>
                </Html>
            </Suspense>
        </Canvas>
    );
};

export default Frame3D;
