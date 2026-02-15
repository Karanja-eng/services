import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// SANITARY CORE - Data Structures
// ============================================================================

class Point3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    distanceTo(other) {
        return Math.sqrt(
            Math.pow(this.x - other.x, 2) +
            Math.pow(this.y - other.y, 2) +
            Math.pow(this.z - other.z, 2)
        );
    }

    horizontalDistanceTo(other) {
        return Math.sqrt(
            Math.pow(this.x - other.x, 2) +
            Math.pow(this.y - other.y, 2)
        );
    }
}

class Level {
    constructor(invert, cover, ground) {
        this.invert = invert;
        this.cover = cover;
        this.ground = ground;
    }

    depthBelowGround() {
        return this.ground - this.invert;
    }
}

const DESIGN_CODE = {
    MIN_SLOPE_100MM: 1.0,
    MIN_SLOPE_150MM: 0.6,
    MIN_SLOPE_200MM: 0.4,
    MIN_VELOCITY: 0.6,
    MAX_VELOCITY: 3.0,
    SEPTIC_TO_BUILDING: 5.0,
    SEPTIC_TO_WELL: 15.0,
    SOAKPIT_TO_BUILDING: 5.0,

    getMinSlope(diameterMm) {
        if (diameterMm <= 100) return this.MIN_SLOPE_100MM;
        if (diameterMm <= 150) return this.MIN_SLOPE_150MM;
        return this.MIN_SLOPE_200MM;
    }
};

const SOIL_TYPES = {
    GRAVEL: { name: 'Gravel', percolationRate: 100, color: '#a0a0a0' },
    COARSE_SAND: { name: 'Coarse Sand', percolationRate: 60, color: '#d4c4a8' },
    FINE_SAND: { name: 'Fine Sand', percolationRate: 30, color: '#e6d5b8' },
    SANDY_LOAM: { name: 'Sandy Loam', percolationRate: 15, color: '#8b7355' },
    LOAM: { name: 'Loam', percolationRate: 8, color: '#6b5345' },
    CLAY: { name: 'Clay', percolationRate: 1, color: '#8b4513' }
};

// ============================================================================
// SEPTIC TANK DESIGN
// ============================================================================

class SepticTank {
    constructor(tankId, location, population, retentionHours = 48, numChambers = 2) {
        this.tankId = tankId;
        this.location = location;
        this.population = population;
        this.retentionHours = retentionHours;
        this.numChambers = numChambers;

        this.design();
    }

    design() {
        // Calculate capacity (m³)
        const dailyFlow = (this.population * 150) / 1000; // 150 L/person/day
        const volume = dailyFlow * (this.retentionHours / 24);
        this.capacity = volume * 1.3; // Add 30% for sludge/scum

        // Dimensions
        this.depth = 2.0;
        const baseArea = this.capacity / this.depth;
        this.width = Math.sqrt(baseArea / 2.5);
        this.length = this.width * 2.5;

        // Round to practical dimensions
        this.width = Math.round(this.width * 10) / 10;
        this.length = Math.round(this.length * 10) / 10;

        // Wall thicknesses
        this.wallThickness = 0.20;
        this.baseThickness = 0.20;
        this.topThickness = 0.15;

        // Actual capacity
        this.actualCapacity = this.length * this.width * this.depth;

        // Levels
        const groundLevel = this.location.z;
        const coverLevel = groundLevel - 0.3;
        const invertLevel = coverLevel - (this.depth + this.baseThickness + this.topThickness);

        this.levels = new Level(invertLevel, coverLevel, groundLevel);

        // Inlets/outlets
        this.inletInvert = invertLevel + this.baseThickness + this.depth * 0.75;
        this.outletInvert = this.inletInvert - 0.05;

        this.inletPosition = new Point3D(
            this.location.x,
            this.location.y + (this.width + 2 * this.wallThickness) / 2,
            this.inletInvert
        );

        this.outletPosition = new Point3D(
            this.location.x + this.length + 2 * this.wallThickness,
            this.location.y + (this.width + 2 * this.wallThickness) / 2,
            this.outletInvert
        );
    }

    toJSON() {
        return {
            id: this.tankId,
            type: 'septic_tank',
            population: this.population,
            capacity: this.actualCapacity,
            dimensions: {
                length: this.length,
                width: this.width,
                depth: this.depth
            },
            location: this.location,
            levels: {
                invert: this.levels.invert,
                cover: this.levels.cover,
                ground: this.levels.ground
            },
            connections: {
                inlet: this.inletPosition,
                outlet: this.outletPosition
            },
            chambers: this.numChambers
        };
    }
}

// ============================================================================
// SOAK PIT DESIGN
// ============================================================================

class SoakPit {
    constructor(pitId, location, dailyFlow, soilType) {
        this.pitId = pitId;
        this.location = location;
        this.dailyFlow = dailyFlow;
        this.soilType = soilType;

        this.design();
    }

    design() {
        const percRateMDay = (this.soilType.percolationRate / 1000) * 24;
        const safetyFactor = 2.0;
        this.requiredArea = (this.dailyFlow * safetyFactor) / percRateMDay;

        this.effectiveDepth = 2.0;
        this.radius = this.requiredArea / (2 * Math.PI * this.effectiveDepth);

        if (this.radius < 0.75) this.radius = 0.75;
        this.radius = Math.round(this.radius * 4) / 4;

        this.diameter = this.radius * 2;

        const wallArea = 2 * Math.PI * this.radius * this.effectiveDepth;
        const baseArea = Math.PI * this.radius * this.radius;
        this.actualArea = wallArea + baseArea;

        this.baseGravel = 0.30;
        this.topCover = 0.30;
        this.totalDepth = this.baseGravel + this.effectiveDepth + this.topCover;

        const groundLevel = this.location.z;
        const coverLevel = groundLevel - 0.15;
        const invertLevel = coverLevel - this.totalDepth;

        this.levels = new Level(invertLevel, coverLevel, groundLevel);

        const inletLevel = invertLevel + this.baseGravel + this.effectiveDepth - 0.2;
        this.inletPosition = new Point3D(
            this.location.x,
            this.location.y + this.radius,
            inletLevel
        );
    }

    toJSON() {
        return {
            id: this.pitId,
            type: 'soakpit',
            dailyFlow: this.dailyFlow,
            soilType: this.soilType.name,
            radius: this.radius,
            diameter: this.diameter,
            effectiveDepth: this.effectiveDepth,
            infiltrationArea: this.actualArea,
            location: this.location,
            levels: {
                invert: this.levels.invert,
                cover: this.levels.cover
            },
            inlet: this.inletPosition
        };
    }
}

// ============================================================================
// SEWER PIPE DESIGN
// ============================================================================

class SewerPipe {
    constructor(pipeId, startPoint, endPoint, diameter = 0.150) {
        this.pipeId = pipeId;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.diameter = diameter;

        this.calculate();
    }

    calculate() {
        this.horizontalLength = this.startPoint.horizontalDistanceTo(this.endPoint);
        this.length = this.startPoint.distanceTo(this.endPoint);

        this.drop = this.startPoint.z - this.endPoint.z;

        if (this.drop < 0) {
            throw new Error(`Backfall detected: ${this.drop.toFixed(3)}m`);
        }

        this.slope = (this.drop / this.horizontalLength) * 100;

        const minSlope = DESIGN_CODE.getMinSlope(this.diameter * 1000);
        if (this.slope < minSlope) {
            throw new Error(`Slope ${this.slope.toFixed(2)}% below minimum ${minSlope}%`);
        }

        // Manning's equation
        const n = 0.010; // PVC
        const R = this.diameter / 4;
        const S = this.slope / 100;

        this.velocityFull = (1 / n) * Math.pow(R, 2 / 3) * Math.pow(S, 0.5);
        const area = Math.PI * Math.pow(this.diameter / 2, 2);
        this.capacityFull = area * this.velocityFull;

        this.velocityDesign = this.velocityFull * 0.9;

        if (this.velocityDesign < DESIGN_CODE.MIN_VELOCITY) {
            throw new Error(`Velocity ${this.velocityDesign.toFixed(2)} m/s below minimum`);
        }
    }

    toJSON() {
        return {
            id: this.pipeId,
            type: 'pipe',
            start: this.startPoint,
            end: this.endPoint,
            diameter: this.diameter,
            length: this.horizontalLength,
            drop: this.drop,
            slope: this.slope,
            velocity: this.velocityDesign
        };
    }
}

// Auto-correcting pipe
function connectPointsWithPipe(start, end, minSlope, diameter) {
    const horizDist = start.horizontalDistanceTo(end);
    const requiredDrop = (minSlope / 100) * horizDist;
    const actualDrop = start.z - end.z;

    if (actualDrop < requiredDrop) {
        end = new Point3D(end.x, end.y, start.z - requiredDrop);
    }

    return new SewerPipe(`P_${Date.now()}`, start, end, diameter);
}

// ============================================================================
// 3D VISUALIZATION COMPONENTS
// ============================================================================

function SepticTankMesh({ tank, selected, onSelect }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    const totalLength = tank.length + 2 * tank.wallThickness;
    const totalWidth = tank.width + 2 * tank.wallThickness;
    const totalHeight = tank.depth + tank.baseThickness + tank.topThickness;

    return (
        <group
            position={[
                tank.location.x + totalLength / 2,
                tank.location.z + totalHeight / 2,
                -(tank.location.y + totalWidth / 2)
            ]}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(tank);
            }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {/* Outer box */}
            <mesh>
                <boxGeometry args={[totalLength, totalHeight, totalWidth]} />
                <meshStandardMaterial
                    color={selected ? '#3b82f6' : hovered ? '#60a5fa' : '#8b7355'}
                    transparent
                    opacity={0.7}
                />
            </mesh>

            {/* Inner cavity */}
            <mesh position={[0, (tank.topThickness - tank.baseThickness) / 2, 0]}>
                <boxGeometry args={[tank.length, tank.depth, tank.width]} />
                <meshStandardMaterial
                    color="#1e293b"
                    transparent
                    opacity={0.3}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Label */}
            {(selected || hovered) && (
                <Html position={[0, totalHeight / 2 + 0.5, 0]} center>
                    <div className="bg-slate-800 text-white px-3 py-1 rounded-lg shadow-lg text-sm whitespace-nowrap">
                        <div className="font-bold">{tank.tankId}</div>
                        <div className="text-xs text-slate-300">{tank.actualCapacity.toFixed(2)} m³</div>
                    </div>
                </Html>
            )}

            {/* Inlet/outlet indicators */}
            <mesh position={[
                -totalLength / 2,
                (tank.inletInvert - tank.location.z - totalHeight / 2),
                0
            ]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
            </mesh>

            <mesh position={[
                totalLength / 2,
                (tank.outletInvert - tank.location.z - totalHeight / 2),
                0
            ]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
            </mesh>
        </group>
    );
}

function SoakPitMesh({ pit, selected, onSelect }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    return (
        <group
            position={[
                pit.location.x,
                pit.location.z + pit.totalDepth / 2,
                -pit.location.y
            ]}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(pit);
            }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            {/* Outer cylinder (gravel) */}
            <mesh>
                <cylinderGeometry args={[pit.radius + 0.3, pit.radius + 0.3, pit.totalDepth, 24]} />
                <meshStandardMaterial
                    color={pit.soilType.color}
                    transparent
                    opacity={0.4}
                />
            </mesh>

            {/* Inner perforated wall */}
            <mesh position={[0, (pit.topCover - pit.baseGravel) / 2, 0]}>
                <cylinderGeometry args={[pit.radius, pit.radius, pit.effectiveDepth, 24]} />
                <meshStandardMaterial
                    color={selected ? '#3b82f6' : hovered ? '#60a5fa' : '#94a3b8'}
                    wireframe={true}
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* Label */}
            {(selected || hovered) && (
                <Html position={[0, pit.totalDepth / 2 + 0.5, 0]} center>
                    <div className="bg-slate-800 text-white px-3 py-1 rounded-lg shadow-lg text-sm whitespace-nowrap">
                        <div className="font-bold">{pit.pitId}</div>
                        <div className="text-xs text-slate-300">Ø{pit.diameter.toFixed(2)}m</div>
                    </div>
                </Html>
            )}

            {/* Inlet indicator */}
            <mesh position={[
                0,
                (pit.inletPosition.z - pit.location.z - pit.totalDepth / 2),
                pit.radius
            ]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
            </mesh>
        </group>
    );
}

function PipeMesh({ pipe, selected, onSelect }) {
    const [hovered, setHovered] = useState(false);

    const start = [pipe.startPoint.x, pipe.startPoint.z, -pipe.startPoint.y];
    const end = [pipe.endPoint.x, pipe.endPoint.z, -pipe.endPoint.y];

    const direction = new THREE.Vector3(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2]
    );
    const length = direction.length();
    direction.normalize();

    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    const midpoint = [
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
        (start[2] + end[2]) / 2
    ];

    return (
        <group
            position={midpoint}
            quaternion={quaternion}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(pipe);
            }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            <mesh>
                <cylinderGeometry args={[pipe.diameter / 2, pipe.diameter / 2, length, 16]} />
                <meshStandardMaterial
                    color={selected ? '#3b82f6' : hovered ? '#60a5fa' : '#64748b'}
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* Flow direction arrow */}
            <mesh position={[0, -length / 4, 0]}>
                <coneGeometry args={[pipe.diameter * 0.6, pipe.diameter * 1.5, 8]} />
                <meshStandardMaterial
                    color="#22c55e"
                    emissive="#22c55e"
                    emissiveIntensity={0.3}
                />
            </mesh>

            {(selected || hovered) && (
                <Html position={[0, 0, 0]} center>
                    <div className="bg-slate-800 text-white px-3 py-1 rounded-lg shadow-lg text-sm whitespace-nowrap">
                        <div className="font-bold">{pipe.pipeId}</div>
                        <div className="text-xs text-slate-300">
                            Slope: {pipe.slope.toFixed(2)}% | V: {pipe.velocityDesign.toFixed(2)} m/s
                        </div>
                    </div>
                </Html>
            )}
        </group>
    );
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function SanitaryEngineeringBIM() {
    const [system, setSystem] = useState(null);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [designParams, setDesignParams] = useState({
        population: 5,
        soilType: SOIL_TYPES.SANDY_LOAM,
        septicX: 10,
        septicY: 5,
        soakawayX: 25,
        soakawayY: 5
    });

    const designSystem = () => {
        try {
            setValidationErrors([]);

            const buildingLoc = new Point3D(0, 0, 100);
            const septicLoc = new Point3D(designParams.septicX, designParams.septicY, 100);
            const soakawayLoc = new Point3D(designParams.soakawayX, designParams.soakawayY, 100);

            // Design septic tank
            const septic = new SepticTank(
                `ST_${designParams.population}P`,
                septicLoc,
                designParams.population,
                48,
                designParams.population > 5 ? 2 : 1
            );

            // Design soakaway
            const dailyFlow = (designParams.population * 150) / 1000;
            const soakpit = new SoakPit(
                `SP_${Math.round(dailyFlow * 1000)}L`,
                soakawayLoc,
                dailyFlow,
                designParams.soilType
            );

            // Connect with pipe
            const pipe = connectPointsWithPipe(
                septic.outletPosition,
                soakpit.inletPosition,
                1.0,
                0.100
            );
            pipe.pipeId = 'Septic_to_Soakaway';

            // Validate separations
            const errors = [];
            const septicDist = septicLoc.horizontalDistanceTo(buildingLoc);
            if (septicDist < DESIGN_CODE.SEPTIC_TO_BUILDING) {
                errors.push(`Septic tank only ${septicDist.toFixed(1)}m from building (min ${DESIGN_CODE.SEPTIC_TO_BUILDING}m)`);
            }

            const soakpitDist = soakawayLoc.horizontalDistanceTo(buildingLoc);
            if (soakpitDist < DESIGN_CODE.SOAKPIT_TO_BUILDING) {
                errors.push(`Soakaway only ${soakpitDist.toFixed(1)}m from building (min ${DESIGN_CODE.SOAKPIT_TO_BUILDING}m)`);
            }

            setValidationErrors(errors);

            setSystem({
                septicTank: septic,
                soakPit: soakpit,
                pipes: [pipe],
                building: buildingLoc,
                validated: errors.length === 0
            });

        } catch (error) {
            setValidationErrors([error.message]);
        }
    };

    useEffect(() => {
        designSystem();
    }, []);

    return (
        <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
            {/* Left Panel - Controls */}
            <div className="w-96 bg-slate-800/50 backdrop-blur-sm border-r border-slate-700 overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="border-b border-slate-700 pb-4">
                        <h1 className="text-2xl font-bold text-white mb-1">
                            Sanitary Engineering BIM
                        </h1>
                        <p className="text-sm text-slate-400">
                            Complete underground infrastructure design
                        </p>
                    </div>

                    {/* Design Parameters */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-white">Design Parameters</h2>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Population Served
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={designParams.population}
                                onChange={(e) => setDesignParams({ ...designParams, population: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Soil Type
                            </label>
                            <select
                                value={designParams.soilType.name}
                                onChange={(e) => {
                                    const selected = Object.values(SOIL_TYPES).find(s => s.name === e.target.value);
                                    setDesignParams({ ...designParams, soilType: selected });
                                }}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {Object.values(SOIL_TYPES).map(soil => (
                                    <option key={soil.name} value={soil.name}>
                                        {soil.name} ({soil.percolationRate} mm/hr)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Septic X (m)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={designParams.septicX}
                                    onChange={(e) => setDesignParams({ ...designParams, septicX: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Septic Y (m)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={designParams.septicY}
                                    onChange={(e) => setDesignParams({ ...designParams, septicY: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Soakaway X (m)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={designParams.soakawayX}
                                    onChange={(e) => setDesignParams({ ...designParams, soakawayX: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Soakaway Y (m)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={designParams.soakawayY}
                                    onChange={(e) => setDesignParams({ ...designParams, soakawayY: parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                                />
                            </div>
                        </div>

                        <button
                            onClick={designSystem}
                            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg"
                        >
                            Redesign System
                        </button>
                    </div>

                    {/* Validation Status */}
                    <div className="border-t border-slate-700 pt-4">
                        <h2 className="text-lg font-semibold text-white mb-3">Validation</h2>
                        {validationErrors.length === 0 ? (
                            <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">System Valid</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {validationErrors.map((error, i) => (
                                    <div key={i} className="flex items-start gap-2 text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm">{error}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Component Details */}
                    {selectedComponent && (
                        <div className="border-t border-slate-700 pt-4">
                            <h2 className="text-lg font-semibold text-white mb-3">Component Details</h2>
                            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                                <div>
                                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">ID</div>
                                    <div className="text-white font-mono">{selectedComponent.id || selectedComponent.tankId || selectedComponent.pitId || selectedComponent.pipeId}</div>
                                </div>

                                {selectedComponent.capacity && (
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Capacity</div>
                                        <div className="text-white">{selectedComponent.capacity.toFixed(2)} m³</div>
                                    </div>
                                )}

                                {selectedComponent.actualCapacity && (
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Actual Capacity</div>
                                        <div className="text-white">{selectedComponent.actualCapacity.toFixed(2)} m³</div>
                                    </div>
                                )}

                                {selectedComponent.slope && (
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Slope</div>
                                        <div className="text-white">{selectedComponent.slope.toFixed(2)}%</div>
                                    </div>
                                )}

                                {selectedComponent.velocityDesign && (
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Velocity</div>
                                        <div className="text-white">{selectedComponent.velocityDesign.toFixed(2)} m/s</div>
                                    </div>
                                )}

                                {selectedComponent.diameter && (
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Diameter</div>
                                        <div className="text-white">{(selectedComponent.diameter * 1000).toFixed(0)} mm</div>
                                    </div>
                                )}

                                {selectedComponent.length && selectedComponent.width && (
                                    <div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Dimensions</div>
                                        <div className="text-white">
                                            {selectedComponent.length.toFixed(2)} × {selectedComponent.width.toFixed(2)} × {selectedComponent.depth.toFixed(2)} m
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* System Summary */}
                    {system && (
                        <div className="border-t border-slate-700 pt-4">
                            <h2 className="text-lg font-semibold text-white mb-3">System Summary</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span>Population</span>
                                    <span className="font-mono">{designParams.population}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>Septic Capacity</span>
                                    <span className="font-mono">{system.septicTank.actualCapacity.toFixed(2)} m³</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>Soakaway Area</span>
                                    <span className="font-mono">{system.soakPit.actualArea.toFixed(2)} m²</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>Total Pipe Length</span>
                                    <span className="font-mono">{system.pipes[0].horizontalLength.toFixed(2)} m</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>Elevation Drop</span>
                                    <span className="font-mono">{system.pipes[0].drop.toFixed(2)} m</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - 3D Visualization */}
            <div className="flex-1 relative">
                <Canvas shadows camera={{ position: [30, 25, 30], fov: 50 }}>
                    <color attach="background" args={['#0f172a']} />
                    <fog attach="fog" args={['#0f172a', 30, 100]} />

                    <ambientLight intensity={0.4} />
                    <directionalLight
                        position={[10, 20, 10]}
                        intensity={0.8}
                        castShadow
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                    />
                    <pointLight position={[-10, 10, -10]} intensity={0.3} color="#60a5fa" />

                    <Grid
                        args={[50, 50]}
                        cellSize={1}
                        cellThickness={0.5}
                        cellColor="#334155"
                        sectionSize={5}
                        sectionThickness={1}
                        sectionColor="#475569"
                        fadeDistance={50}
                        fadeStrength={1}
                        followCamera={false}
                        infiniteGrid={false}
                    />

                    {system && (
                        <>
                            {/* Building indicator */}
                            <mesh position={[0, 0.5, 0]} receiveShadow>
                                <boxGeometry args={[3, 1, 3]} />
                                <meshStandardMaterial color="#94a3b8" />
                            </mesh>

                            <SepticTankMesh
                                tank={system.septicTank}
                                selected={selectedComponent === system.septicTank}
                                onSelect={setSelectedComponent}
                            />

                            <SoakPitMesh
                                pit={system.soakPit}
                                selected={selectedComponent === system.soakPit}
                                onSelect={setSelectedComponent}
                            />

                            {system.pipes.map((pipe, i) => (
                                <PipeMesh
                                    key={i}
                                    pipe={pipe}
                                    selected={selectedComponent === pipe}
                                    onSelect={setSelectedComponent}
                                />
                            ))}
                        </>
                    )}

                    <OrbitControls
                        enableDamping
                        dampingFactor={0.05}
                        minDistance={5}
                        maxDistance={100}
                        maxPolarAngle={Math.PI / 2}
                    />
                </Canvas>

                {/* Legend */}
                <div className="absolute bottom-6 left-6 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                    <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
                    <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-[#8b7355] rounded"></div>
                            <span>Septic Tank</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-[#94a3b8] rounded"></div>
                            <span>Soakaway</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-[#64748b] rounded"></div>
                            <span>Sewer Pipe</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <span>Inlet</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                            <span>Outlet</span>
                        </div>
                    </div>
                </div>

                {/* Controls Help */}
                <div className="absolute top-6 right-6 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
                    <h3 className="text-sm font-semibold text-white mb-2">Controls</h3>
                    <div className="space-y-1 text-xs text-slate-300">
                        <div>Left Mouse: Rotate</div>
                        <div>Right Mouse: Pan</div>
                        <div>Scroll: Zoom</div>
                        <div>Click: Select Component</div>
                    </div>
                </div>
            </div>
        </div>
    );
}