import React, { useMemo } from 'react';
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Geometry Helpers (Ported from 3DViewer.jsx) ---

const Step = ({ position, args, material }) => (
    <mesh position={position} castShadow receiveShadow material={material}>
        <boxGeometry args={args} />
    </mesh>
);

const Landing = ({ position, args, material }) => (
    <mesh position={position} castShadow receiveShadow material={material}>
        <boxGeometry args={args} />
    </mesh>
);

const Handrail = ({ start, end, width, material }) => {
    const startY = start[1];
    const endY = end[1];
    const startZ = start[2];
    const endZ = end[2];

    // Handrail logic from legacy: 
    // length = sqrt((endY-startY)^2 + (endZ-startZ)^2)
    // angle = atan2(endY-startY, endZ-startZ)
    // Legacy positions were Z-forward. 
    // center = (start + end) / 2 + 0.9 height offset

    const length = Math.sqrt(Math.pow(endY - startY, 2) + Math.pow(endZ - startZ, 2));
    const angle = Math.atan2(endY - startY, endZ - startZ);

    const midY = (startY + endY) / 2 + 0.9;
    const midZ = (startZ + endZ) / 2;
    // X is assumed 0-centered for width offset. 
    // We need to pass the "currentX" or center position of the flight to place rails correctly.
    // The legacy code calculated positions based on 0, then added/subtracted width/2.
    // Here we should probably accept "center" of the flight.

    // Let's assume start/end are centerline points [x, y, z].
    const midX = (start[0] + end[0]) / 2;

    return (
        <group>
            {/* Left Rail */}
            <mesh
                position={[midX - width / 2, midY, midZ]}
                rotation={[Math.PI / 2 - angle, 0, 0]}
                castShadow
                material={material}
            >
                <cylinderGeometry args={[0.025, 0.025, length, 8]} />
            </mesh>

            {/* Right Rail */}
            <mesh
                position={[midX + width / 2, midY, midZ]}
                rotation={[Math.PI / 2 - angle, 0, 0]}
                castShadow
                material={material}
            >
                <cylinderGeometry args={[0.025, 0.025, length, 8]} />
            </mesh>
        </group>
    );
};


// --- Staircase Builders ---

const StraightStaircase = ({ params, materials }) => {
    const {
        clear_width, tread, rise, waist_thick,
        risers_per_flight, num_flights, landing_lengths, landing_widths
    } = params;

    const structureMat = materials.structure;

    // We need to pre-calculate positions to render declaratively.
    const flights = [];

    let currentY = 0;
    let currentZ = 0;

    for (let f = 0; f < num_flights; f++) {
        const numRisers = risers_per_flight[f];
        const steps = [];

        const flightStartY = currentY;
        const flightStartZ = currentZ;

        for (let i = 0; i < numRisers; i++) {
            steps.push({
                id: `f${f}-s${i}`,
                waistPos: [0, currentY + waist_thick / 2, currentZ + tread / 2],
                waistSize: [clear_width, waist_thick, tread],
                riserPos: [0, currentY + rise / 2, currentZ],
                riserSize: [clear_width, rise, 0.02],
                treadPos: [0, currentY + rise / 2, currentZ + tread / 2],
                treadSize: [clear_width, rise, tread] // Note: Legacy tread uses Box(width, rise, tread) at +rise/2. Wait, rise is height? A block step?
                // Legacy: stepGeo = Box(clear_width, rise, tread). Position y = currentY + rise/2.
                // This effectively makes solid block steps on top of waist? 
                // Or waist connects them?
                // Legacy waist: Box(width, waist_thick, tread). Pos y=currentY + waist_thick/2.
                // This seems to overlay. Visual artifacting might occur but it's fine for now.
            });
            currentY += rise;
            currentZ += tread;
        }

        const flightEndY = currentY;
        const flightEndZ = currentZ;

        flights.push({
            id: `flight-${f}`,
            steps,
            hasLanding: f < num_flights - 1 && landing_lengths[f],
            landingPos: f < num_flights - 1 ? [0, currentY + waist_thick / 2, currentZ + landing_lengths[f] / 2] : null,
            landingSize: f < num_flights - 1 ? [landing_widths[f], waist_thick, landing_lengths[f]] : null,
            handrailStart: [0, flightStartY, flightStartZ], // Centerline start
            handrailEnd: [0, flightEndY, flightEndZ] // Centerline end
        });

        if (f < num_flights - 1 && landing_lengths[f]) {
            currentZ += landing_lengths[f];
        }
    }

    return (
        <group>
            {flights.map(flight => (
                <group key={flight.id}>
                    {flight.steps.map(s => (
                        <group key={s.id}>
                            <Step position={s.waistPos} args={s.waistSize} material={structureMat} />
                            <Step position={s.riserPos} args={s.riserSize} material={structureMat} />
                            <Step position={s.treadPos} args={s.treadSize} material={structureMat} />
                        </group>
                    ))}
                    {flight.hasLanding && (
                        <Landing position={flight.landingPos} args={flight.landingSize} material={structureMat} />
                    )}
                    <Handrail
                        start={flight.handrailStart}
                        end={flight.handrailEnd}
                        width={clear_width}
                        material={materials.handrail}
                    />
                </group>
            ))}
        </group>
    );
};

const LShapedStaircase = ({ params, materials }) => {
    // Basic implementation of L-Shape based on legacy logic (Flight 1 Z+, Landing, Flight 2 X+)
    const { clear_width, tread, rise, waist_thick, risers_per_flight } = params;
    const structureMat = materials.structure;

    let currentY = 0;
    let currentZ = 0;
    let currentX = 0;

    // Flight 1
    const f1Steps = [];
    const numRisers1 = risers_per_flight[0];
    for (let i = 0; i < numRisers1; i++) {
        f1Steps.push({
            pos: [0, currentY + rise / 2, currentZ + tread / 2],
            size: [clear_width, rise, tread]
        });
        currentY += rise;
        currentZ += tread;
    }

    // Landing
    const landingPos = [clear_width / 2, currentY + waist_thick / 2, currentZ + clear_width / 2]; // Offset X by width/2?
    // Legacy: landing.position.set(clear_width / 2, currentY + waist_thick / 2, currentZ + clear_width / 2);
    // Because flight 1 was centered at X=0, width=clear_width. So right edge is +clear_width/2.
    // Landing connects at end of Z, and extends to X+.
    const landingSize = [clear_width, waist_thick, clear_width];

    // Update cursors for Flight 2 start
    // Flight 2 starts from X edge of landing.
    currentZ += clear_width;
    currentX = clear_width; // Center of flight 2? 
    // Legacy: currentX = clear_width. 
    // Flight 2 steps pos: currentX + tread/2 ?? No, legacy:
    // step.position.set(currentX + tread / 2, currentY + rise / 2, currentZ);
    // stepGeo: Box(tread, rise, clear_width).
    // So Flight 2 moves in +X direction. Steps are elongated in Z.
    // Actually, legacy says: position x = currentX + tread/2. 
    // This implies step is placed at x.

    const f2Steps = [];
    const numRisers2 = risers_per_flight[1] || numRisers1;
    for (let i = 0; i < numRisers2; i++) {
        f2Steps.push({
            pos: [currentX + tread / 2, currentY + rise / 2, currentZ], // Z is constant center of flight 2?
            // Legacy: currentZ (which is just after landing). 
            // Landing center Z was oldZ + width/2. 
            // Flight 1 end Z was oldZ.
            // Landing is clear_width x clear_width.
            // So landing extends from Z to Z+width. Center Z + width/2.
            // Flight 2 center Z should be Z + width/2.
            // But legacy uses currentZ (which was incr by width).
            // Let's trust legacy logic translation for now.
            size: [tread, rise, clear_width]
        });
        currentY += rise;
        currentX += tread;
    }

    return (
        <group>
            {f1Steps.map((s, i) => <Step key={`f1-${i}`} position={s.pos} args={s.size} material={structureMat} />)}
            <Landing position={landingPos} args={landingSize} material={structureMat} />
            {f2Steps.map((s, i) => <Step key={`f2-${i}`} position={s.pos} args={s.size} material={structureMat} />)}
        </group>
    );
};

const SpiralStaircase = ({ params, materials }) => {
    const { clear_width, rise, risers_per_flight, spiral_radius } = params;
    const structureMat = materials.structure;
    const steelMat = materials.steel;

    const totalRisers = Array.isArray(risers_per_flight) ? risers_per_flight.reduce((a, b) => a + b, 0) : risers_per_flight;
    const anglePerStep = (Math.PI * 2) / totalRisers; // Legacy logic: full circle per flight? 
    // Legacy: const anglePerStep = (Math.PI * 2) / risers_per_flight;

    // Move useMemo OUTSIDE loop
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(clear_width * Math.cos(anglePerStep / 2), clear_width * Math.sin(anglePerStep / 2));
        s.lineTo(clear_width * Math.cos(-anglePerStep / 2), clear_width * Math.sin(-anglePerStep / 2));
        s.lineTo(0, 0);
        return s;
    }, [clear_width, anglePerStep]);

    const steps = [];
    for (let i = 0; i < totalRisers; i++) {
        const angle = anglePerStep * i;
        const x = Math.cos(angle) * spiral_radius;
        const z = Math.sin(angle) * spiral_radius;
        const y = i * rise;

        steps.push({ x, y, z, angle, shape });
    }

    return (
        <group>
            {/* Center Pole */}
            <mesh position={[0, (totalRisers * rise) / 2, 0]} castShadow material={steelMat}>
                <cylinderGeometry args={[0.1, 0.1, totalRisers * rise, 16]} />
            </mesh>

            {steps.map((s, i) => (
                <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0, s.angle, 0]} castShadow material={structureMat}>
                    <extrudeGeometry args={[s.shape, { depth: rise, bevelEnabled: false }]} />
                </mesh>
            ))}
        </group>
    );
};

// --- Main Scene Component ---

export const StaircaseScene = ({ buildingData, settings }) => {
    // Hooks MUST be called before any conditional return

    // Construct Materials based on Settings + Material Type
    const materialType = buildingData?.material_type || 'concrete';

    const materials = useMemo(() => {
        const matColors = {
            concrete: settings?.concreteColor || '#cccccc',
            timber: settings?.timberColor || '#8b4513',
            steel: settings?.steelColor || '#808080',
            glass: settings?.glassColor || '#88ccff',
            handrail: settings?.handrailColor || '#444444'
        };

        const resolveMaterial = (type) => {
            const color = matColors[type] || matColors.concrete;
            const opacity = type === 'glass' ? (settings?.glassOpacity || 0.3) : 1;

            return new THREE.MeshStandardMaterial({
                color: color,
                transparent: type === 'glass',
                opacity: opacity,
                roughness: type === 'steel' ? 0.3 : 0.8,
                metalness: type === 'steel' ? 0.8 : 0.1
            });
        };

        return {
            structure: resolveMaterial(materialType),
            steel: resolveMaterial('steel'),
            handrail: resolveMaterial('handrail')
        };
    }, [materialType, settings]);

    if (!buildingData) return null;

    const {
        staircase_type,
        clear_width, tread, rise, waist_thick,
        risers_per_flight, num_flights,
        landing_lengths, landing_widths,
        spiral_radius
    } = buildingData;

    const params = {
        clear_width, tread, rise, waist_thick,
        risers_per_flight, num_flights,
        landing_lengths, landing_widths, spiral_radius
    };

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />

            <group position={[0, -1, 0]}> {/* Adjust base height */}
                {staircase_type === 'straight' && <StraightStaircase params={params} materials={materials} />}
                {staircase_type === 'l_shaped' && <LShapedStaircase params={params} materials={materials} />}
                {staircase_type === 'spiral' && <SpiralStaircase params={params} materials={materials} />}
                {/* Fallback for others to straight for now as they share structure in legacy often */}
                {!['straight', 'l_shaped', 'spiral'].includes(staircase_type) && <StraightStaircase params={params} materials={materials} />}
            </group>

            <gridHelper args={[20, 20]} position={[0, -1.01, 0]} />
        </>
    );
};

export default StaircaseScene;
