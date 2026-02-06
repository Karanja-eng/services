import React, { useMemo } from 'react';
import { Line, Text, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const WireframeMember = ({ element, showDiagrams, showForces, scale = 0.002, floorZ = 0, autoScaleMultiplier = 1 }) => {
    const isColumn = element.type === 'column';
    const isBeam = element.type === 'beam';

    const memberColor = useMemo(() => {
        if (!showForces || !element.analysisResults) return "#666";
        const util = element.analysisResults.utilization || 0;
        if (util > 1.0) return "#f44336";
        if (util > 0.8) return "#FF9800";
        if (util > 0.5) return "#FFC107";
        return "#4CAF50";
    }, [showForces, element.analysisResults]);

    const points = useMemo(() => {
        if (isColumn) {
            const h = element.properties.height || 3.5;
            // Columns start at floorZ and go up
            const start = new THREE.Vector3(element.position.x, floorZ, element.position.y);
            const end = new THREE.Vector3(element.position.x, floorZ + h, element.position.y);
            return [start, end];
        } else if (isBeam) {
            // Beams are at floorZ level
            const start = new THREE.Vector3(element.position.start.x, floorZ, element.position.start.y);
            const end = new THREE.Vector3(element.position.end.x, floorZ, element.position.end.y);
            return [start, end];
        }
        return null;
    }, [element, isColumn, isBeam, floorZ]);

    const diagrams = useMemo(() => {
        if (!element.analysisResults?.sections || points.length < 2) return null;

        const sections = element.analysisResults.sections;
        const bmPoints = [];
        const sfPoints = [];
        const defPoints = [];

        const startPos = points[0];
        const endPos = points[1];
        const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();

        // Calculate a better offset direction and scale
        let offsetDir = new THREE.Vector3(0, 1, 0);
        if (isBeam) {
            // Beams diagram usually vertical (in Y)
            offsetDir.set(0, 1, 0);
        } else {
            // Columns diagram perpendicular to member
            let tempNormal = new THREE.Vector3(1, 0, 0);
            if (Math.abs(dir.dot(tempNormal)) > 0.9) tempNormal.set(0, 0, 1);
            offsetDir.crossVectors(dir, tempNormal).normalize();
        }

        // Use the passed auto-scaling multiplier. 
        // multiplier is (TargetHeight / MaxM). scale is user zoom factor (e.g. 5-50)
        // We want effectiveScale = multiplier * (scale / 25) so that at scale=25 it is exactly target height.
        const effectiveScale = autoScaleMultiplier * (scale / 25);

        sections.forEach((s) => {
            const t = s.ratio;
            const basePos = new THREE.Vector3().lerpVectors(startPos, endPos, t);

            if (showDiagrams.moment) {
                const bmOffset = (s.Mz || 0) * effectiveScale;
                bmPoints.push(basePos.clone().add(offsetDir.clone().multiplyScalar(bmOffset)));
            }
            if (showDiagrams.shear) {
                const sfOffset = (s.Vy || 0) * effectiveScale;
                sfPoints.push(basePos.clone().add(offsetDir.clone().multiplyScalar(sfOffset)));
            }
            if (showDiagrams.deflection) {
                const defOffset = (s.delta || 0) * (effectiveScale * 20); // Scale up deflection relative to BMD
                defPoints.push(basePos.clone().add(offsetDir.clone().multiplyScalar(defOffset)));
            }
        });

        return { bmPoints, sfPoints, defPoints };
    }, [element.analysisResults, points, showDiagrams, scale, isBeam, autoScaleMultiplier]);

    if (!points) return null;

    const maxM = element.analysisResults?.M_max || 0;
    const maxV = element.analysisResults?.V_max || 0;

    return (
        <group>
            {/* Member Line */}
            <Line points={points} color={memberColor} lineWidth={1} />

            {/* BMD */}
            {showDiagrams.moment && diagrams?.bmPoints.length > 1 && (
                <group>
                    <Line points={diagrams.bmPoints} color="#D32F2F" lineWidth={2} />
                    {diagrams.bmPoints.map((p, i) => i % 4 === 0 && (
                        <Line
                            key={`bm-tick-${i}`}
                            points={[new THREE.Vector3().lerpVectors(points[0], points[1], i / (diagrams.bmPoints.length - 1)), p]}
                            color="#D32F2F"
                            lineWidth={0.5}
                            transparent
                            opacity={0.3}
                        />
                    ))}
                    {/* Max Value Indicator */}
                    <Text
                        position={diagrams.bmPoints[Math.floor(diagrams.bmPoints.length / 2)]}
                        fontSize={0.2}
                        color="#D32F2F"
                        anchorX="center"
                    >
                        {maxM.toFixed(1)}
                    </Text>
                </group>
            )}

            {/* SFD */}
            {showDiagrams.shear && diagrams?.sfPoints.length > 1 && (
                <group>
                    <Line points={diagrams.sfPoints} color="#1976D2" lineWidth={2} />
                    {diagrams.sfPoints.map((p, i) => i % 2 === 0 && (
                        <Line
                            key={`sf-tick-${i}`}
                            points={[new THREE.Vector3().lerpVectors(points[0], points[1], i / (diagrams.sfPoints.length - 1)), p]}
                            color="#1976D2"
                            lineWidth={0.5}
                            transparent
                            opacity={0.3}
                        />
                    ))}
                </group>
            )}

            {showDiagrams.deflection && diagrams?.defPoints.length > 1 && (
                <Line points={diagrams.defPoints} color="#388E3C" lineWidth={1} dashed />
            )}

            {/* Nodes */}
            <Sphere args={[0.05, 8, 8]} position={points[0]}><meshBasicMaterial color="#333" /></Sphere>
            <Sphere args={[0.05, 8, 8]} position={points[1]}><meshBasicMaterial color="#333" /></Sphere>
        </group>
    );
};

const WireframeAnalysisView = ({
    elements,
    showDiagrams = { moment: true, shear: false },
    showForces = false,
    floorHeight = 3.5,
    diagramScale = 0.002
}) => {
    const members = useMemo(() => {
        return elements.filter(el => el.type === 'column' || el.type === 'beam');
    }, [elements]);

    // Calculate auto-scale multiplier based on max building moment
    const autoScaleMultiplier = useMemo(() => {
        let maxBuildingM = 0;
        let anyResult = false;

        members.forEach(el => {
            const m = Math.abs(el.analysisResults?.M_max || 0);
            if (m > 0) anyResult = true;
            if (m > maxBuildingM) maxBuildingM = m;
        });

        if (!anyResult || maxBuildingM < 0.001) return 100; // Large fallback if values are tiny

        // Aim for the largest moment diagram to be about 0.8 meters tall
        return 0.8 / maxBuildingM;
    }, [members]);

    return (
        <group>
            {members.map(el => {
                const floorIndex = parseInt(el.layer?.replace('Floor ', '')) || 1;
                const floorZ = (floorIndex - 1) * floorHeight;
                const z = el.type === 'beam' ? floorZ + floorHeight : floorZ;

                return (
                    <WireframeMember
                        key={el.id}
                        element={el}
                        showDiagrams={showDiagrams}
                        showForces={showForces}
                        floorZ={z}
                        scale={diagramScale}
                        autoScaleMultiplier={autoScaleMultiplier}
                    />
                );
            })}
        </group>
    );
};

export default WireframeAnalysisView;
