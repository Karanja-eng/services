import React, { useMemo } from 'react';
import { Line, Text, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const WireframeMember = ({ element, showDiagrams, scale = 0.002, floorZ = 0 }) => {
    const isColumn = element.type === 'column';
    const isBeam = element.type === 'beam';

    const points = useMemo(() => {
        if (isColumn) {
            const h = element.properties.height || 3.5;
            const start = new THREE.Vector3(element.position.x, element.position.z || 0, element.position.y);
            const end = new THREE.Vector3(element.position.x, (element.position.z || 0) + h, element.position.y);
            return [start, end];
        } else if (isBeam) {
            const start = new THREE.Vector3(element.position.start.x, floorZ, element.position.start.y);
            const end = new THREE.Vector3(element.position.end.x, floorZ, element.position.end.y);
            return [start, end];
        }
        return null;
    }, [element, isColumn, isBeam, floorZ]);

    const diagrams = useMemo(() => {
        if (!element.analysisResults?.sections || (!showDiagrams.moment && !showDiagrams.shear && !showDiagrams.deflection)) return null;

        const sections = element.analysisResults.sections;
        const bmPoints = [];
        const sfPoints = [];
        const defPoints = [];

        const startPos = points[0];
        const endPos = points[1];
        const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();

        // Diagram orientation logic
        let offsetDir = new THREE.Vector3(0, 1, 0);
        if (isBeam) {
            offsetDir.set(0, 1, 0); // Beams diagrams are vertical
        } else {
            // Columns: perpendicular to member and roughly in frame plane
            let tempNormal = new THREE.Vector3(0, 0, 1);
            if (Math.abs(dir.dot(tempNormal)) > 0.9) tempNormal.set(1, 0, 0);
            offsetDir.crossVectors(dir, tempNormal).normalize();
        }

        sections.forEach(s => {
            const t = s.ratio;
            const basePos = new THREE.Vector3().lerpVectors(startPos, endPos, t);

            if (showDiagrams.moment) {
                const bmOffset = (s.Mz || 0) * scale;
                bmPoints.push(basePos.clone().add(offsetDir.clone().multiplyScalar(bmOffset)));
            }
            if (showDiagrams.shear) {
                const sfOffset = (s.Vy || 0) * scale;
                sfPoints.push(basePos.clone().add(offsetDir.clone().multiplyScalar(sfOffset)));
            }
            if (showDiagrams.deflection) {
                const defOffset = (s.delta || 0) * (scale * 50); // Scale up deflection for visibility
                defPoints.push(basePos.clone().add(offsetDir.clone().multiplyScalar(defOffset)));
            }
        });

        return { bmPoints, sfPoints, defPoints };
    }, [element.analysisResults, points, showDiagrams, scale, isBeam]);

    if (!points) return null;

    return (
        <group>
            {/* Member Line */}
            <Line points={points} color="#444444" lineWidth={1} />

            {/* Bending Moment Diagram */}
            {showDiagrams.moment && diagrams?.bmPoints.length > 1 && (
                <group>
                    <Line points={diagrams.bmPoints} color="#ef4444" lineWidth={2} />
                    {/* Tick lines for "Manual Book" feel */}
                    {diagrams.bmPoints.map((p, i) => i % 4 === 0 && (
                        <Line
                            key={`bm-tick-${i}`}
                            points={[new THREE.Vector3().lerpVectors(points[0], points[1], i / (diagrams.bmPoints.length - 1)), p]}
                            color="#ef4444"
                            lineWidth={0.5}
                            transparent
                            opacity={0.3}
                        />
                    ))}
                </group>
            )}

            {/* Shear Force Diagram */}
            {showDiagrams.shear && diagrams?.sfPoints.length > 1 && (
                <group>
                    <Line points={diagrams.sfPoints} color="#3b82f6" lineWidth={2} />
                    {/* SFD Fill Ticks */}
                    {diagrams.sfPoints.map((p, i) => i % 2 === 0 && (
                        <Line
                            key={`sf-tick-${i}`}
                            points={[new THREE.Vector3().lerpVectors(points[0], points[1], i / (diagrams.sfPoints.length - 1)), p]}
                            color="#3b82f6"
                            lineWidth={0.5}
                            transparent
                            opacity={0.2}
                        />
                    ))}
                </group>
            )}

            {/* Deflection Curve */}
            {showDiagrams.deflection && diagrams?.defPoints.length > 1 && (
                <Line points={diagrams.defPoints} color="#10b981" lineWidth={1.5} dashed />
            )}

            {/* Nodes */}
            <Sphere args={[0.04, 8, 8]} position={points[0]}><meshBasicMaterial color="#666" /></Sphere>
            <Sphere args={[0.04, 8, 8]} position={points[1]}><meshBasicMaterial color="#666" /></Sphere>
        </group>
    );
};

const WireframeAnalysisView = ({
    elements,
    showDiagrams = { moment: true, shear: false },
    floorHeight = 3.5,
    diagramScale = 0.002
}) => {
    const members = useMemo(() => {
        return elements.filter(el => el.type === 'column' || el.type === 'beam');
    }, [elements]);

    return (
        <group>
            {members.map(el => {
                const floorIndex = parseInt(el.layer?.replace('Floor ', '')) || 1;
                const floorZ = (floorIndex - 1) * floorHeight;
                // Beams are usually at top of floor, so floorZ + floorHeight
                const z = el.type === 'beam' ? floorZ + floorHeight : floorZ;

                return (
                    <WireframeMember
                        key={el.id}
                        element={el}
                        showDiagrams={showDiagrams}
                        floorZ={z}
                        scale={diagramScale}
                    />
                );
            })}
        </group>
    );
};

export default WireframeAnalysisView;
