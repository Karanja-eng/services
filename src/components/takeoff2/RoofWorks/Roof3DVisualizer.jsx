import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    OrbitControls,
    PerspectiveCamera,
    Float,
    Stats,
} from "@react-three/drei";
import * as THREE from "three";

// Structural Member Component
function Member({ position, rotation = [0, 0, 0], args, color, opacity = 1 }) {
    return (
        <mesh position={position} rotation={rotation}>
            <boxGeometry args={args} />
            <meshStandardMaterial
                color={color}
                transparent={opacity < 1}
                opacity={opacity}
                roughness={0.8}
                metalness={0.2}
            />
        </mesh>
    );
}

// Plane component for roof covering
// Plane component for roof covering
function RoofPlane({ position, rotation, args, color, opacity = 1 }) {
    return (
        <mesh position={position} rotation={rotation} receiveShadow castShadow>
            <planeGeometry args={args} />
            <meshStandardMaterial
                color={color}
                side={THREE.DoubleSide}
                roughness={0.5}
                metalness={0.1}
                transparent={opacity < 1}
                opacity={opacity}
            />
        </mesh>
    );
}

const Gutter = ({ position, rotation, length }) => (
    <mesh position={position} rotation={rotation}>
        <cylinderGeometry args={[0.08, 0.08, length, 16, 1, false, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#546E7A" side={THREE.DoubleSide} />
    </mesh>
);

const Downpipe = ({ position, height }) => (
    <mesh position={position}>
        <cylinderGeometry args={[0.04, 0.04, height, 12]} />
        <meshStandardMaterial color="#546E7A" />
    </mesh>
);

function RoofStructure({ config, visibility }) {
    const {
        roofType,
        buildingLength,
        buildingWidth,
        wallThickness,
        overhang,
        pitchAngle,
        pitchAngle2 = 15,
        breakRatio = 0.6,
        trussSpacing = 1.2,
        rafterSpacing = 0.6,
        material,
        covering,
    } = config;

    const pitch = (pitchAngle * Math.PI) / 180;
    const pitch2 = (pitchAngle2 * Math.PI) / 180;

    // Total Footprint
    const span = buildingWidth + 2 * wallThickness + 2 * overhang;
    const halfSpan = span / 2;
    const length = buildingLength + 2 * wallThickness + 2 * overhang;
    const halfLen = length / 2;

    // Materials
    const colors = {
        timber: { plate: "#5D4037", rafter: "#8D6E63", purlin: "#D7CCC8", ridge: "#3E2723" },
        steel: { plate: "#455A64", rafter: "#78909C", purlin: "#CFD8DC", ridge: "#263238" }
    };
    const c = colors[material] || colors.timber;
    const coveringColors = {
        tiles: "#D84315",
        acSheets: "#9E9E9E",
        giSheets: "#B0BEC5",
        slate: "#37474F",
        thatch: "#FBC02D",
        none: "#FFFFFF"
    };
    const coverCol = coveringColors[covering] || coveringColors.none;

    const renderGable = () => {
        const h = halfSpan * Math.tan(pitch);
        const rafLen = halfSpan / Math.cos(pitch);
        const elements = [];

        // 1. Wall Plates (along X)
        if (visibility.wallPlates) {
            elements.push(
                <Member key="wp-l" position={[0, 0, -halfSpan + overhang]} args={[length, 0.1, 0.1]} color={c.plate} />,
                <Member key="wp-r" position={[0, 0, halfSpan - overhang]} args={[length, 0.1, 0.1]} color={c.plate} />
            );
        }

        // 2. Ridge Board (along X)
        if (visibility.ridge) {
            elements.push(
                <Member key="ridge" position={[0, h, 0]} args={[length, 0.2, 0.03]} color={c.ridge} />
            );
        }

        // 3. Rafters (along Z axis, sloping in Y)
        if (visibility.rafters) {
            const numRaf = Math.floor(length / rafterSpacing) + 1;
            const startX = -halfLen;
            for (let i = 0; i < numRaf; i++) {
                const x = startX + i * rafterSpacing;
                // Left Slope (Fixed direction for 'A' structure)
                elements.push(
                    <Member
                        key={`raf-l-${i}`}
                        position={[x, h / 2, -halfSpan / 2]}
                        rotation={[-pitch, 0, 0]} // Fixed
                        args={[0.05, 0.15, rafLen]}
                        color={c.rafter}
                    />
                );
                // Right Slope (Fixed direction for 'A' structure)
                elements.push(
                    <Member
                        key={`raf-r-${i}`}
                        position={[x, h / 2, halfSpan / 2]}
                        rotation={[pitch, 0, 0]} // Fixed
                        args={[0.05, 0.15, rafLen]}
                        color={c.rafter}
                    />
                );
            }
        }

        // 4. Purlins (along X axis, spaced on the slope)
        if (visibility.purlins) {
            const purlinSpacing = 0.9;
            const numPurlins = Math.floor(rafLen / purlinSpacing);
            const rafDepth = 0.15;
            const purlinSize = 0.05;
            const offset = (rafDepth / 2) + (purlinSize / 2); // Distance to sit exactly on top

            for (let side of [-1, 1]) {
                for (let j = 1; j <= numPurlins; j++) {
                    const distFromEaves = j * purlinSpacing;
                    const ratio = distFromEaves / rafLen;

                    // ratio=0 is eaves, ratio=1 is ridge
                    const pZ_on_slope = side * (halfSpan - (1 - ratio) * overhang) * (1 - ratio) + side * overhang;
                    // Simpler: eaves is at side*halfSpan, ridge is at 0.
                    const pZ = side * halfSpan * (1 - ratio);
                    const pY = h * ratio + offset * Math.cos(pitch);
                    const pZ_final = pZ + side * offset * Math.sin(pitch);

                    elements.push(
                        <Member
                            key={`pur-${side}-${j}`}
                            position={[0, pY, pZ_final]}
                            rotation={[side * pitch, 0, 0]}
                            args={[length, purlinSize, purlinSize]}
                            color={c.purlin}
                        />
                    );
                }
            }
        }

        // 5. Fascia Board (at eaves)
        if (visibility.fascia) {
            elements.push(
                <Member key="fas-l" position={[0, -0.05, -halfSpan]} args={[length, 0.2, 0.02]} color={c.ridge} />,
                <Member key="fas-r" position={[0, -0.05, halfSpan]} args={[length, 0.2, 0.02]} color={c.ridge} />
            );
        }

        // 6. Ridge Cap (Reseta)
        if (visibility.ridge && visibility.covering !== false) {
            elements.push(
                <Member key="rcap" position={[0, h + 0.05, 0]} rotation={[Math.PI / 4, 0, 0]} args={[length, 0.1, 0.1]} color={coverCol} />,
                <Member key="rcap2" position={[0, h + 0.05, 0]} rotation={[-Math.PI / 4, 0, 0]} args={[length, 0.1, 0.1]} color={coverCol} />
            );
        }

        // 7. Roof Covering (Planes)
        if (covering !== "none" && visibility.covering) {
            const covOffset = 0.15 + (visibility.purlins ? 0.075 : 0); // Above rafters + purlins if present
            elements.push(
                <RoofPlane
                    key="cov-l"
                    position={[0, h / 2 + covOffset * Math.cos(pitch), -halfSpan / 2 - covOffset * Math.sin(pitch)]}
                    rotation={[-pitch + Math.PI / 2, 0, 0]}
                    args={[length, rafLen]}
                    color={coverCol}
                />,
                <RoofPlane
                    key="cov-r"
                    position={[0, h / 2 + covOffset * Math.cos(pitch), halfSpan / 2 + covOffset * Math.sin(pitch)]}
                    rotation={[pitch + Math.PI / 2, 0, 0]}
                    args={[length, rafLen]}
                    color={coverCol}
                />
            );
        }

        // 8. Rainwater Goods
        if (config.includeRainwaterGoods && visibility.rainwaterGoods) {
            // Gutters along fascia
            elements.push(
                <Gutter key="gut-l" position={[0, -0.05, -halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />,
                <Gutter key="gut-r" position={[0, -0.05, halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />
            );
            // Downpipes at 4 corners
            const dpH = 4;
            [[-halfLen, -halfSpan], [halfLen, -halfSpan], [-halfLen, halfSpan], [halfLen, halfSpan]].forEach(([x, z], i) => {
                elements.push(<Downpipe key={`dp-${i}`} position={[x, -dpH / 2 - 0.05, z]} height={dpH} />);
            });
        }

        return elements;
    };

    const renderLeanTo = () => {
        const h = span * Math.tan(pitch);
        const rafLen = span / Math.cos(pitch);
        const elements = [];

        // High Plate and Low Plate
        if (visibility.wallPlates) {
            elements.push(
                <Member key="wp-low" position={[0, 0, halfSpan]} args={[length, 0.1, 0.1]} color={c.plate} />,
                <Member key="wp-high" position={[0, h, -halfSpan]} args={[length, 0.1, 0.1]} color={c.plate} />
            );
        }

        if (visibility.rafters) {
            const numRaf = Math.floor(length / rafterSpacing) + 1;
            for (let i = 0; i < numRaf; i++) {
                const x = -halfLen + i * rafterSpacing;
                elements.push(
                    <Member
                        key={`raf-${i}`}
                        position={[x, h / 2, 0]}
                        rotation={[pitch, 0, 0]} // Fixed
                        args={[0.05, 0.15, rafLen]}
                        color={c.rafter}
                    />
                );
            }
        }

        // Purlins
        if (visibility.purlins) {
            const purlinSpacing = 0.9;
            const numP = Math.floor(rafLen / purlinSpacing);
            const rafDepth = 0.15;
            const purlinSize = 0.05;
            const offset = (rafDepth / 2) + (purlinSize / 2);

            for (let j = 1; j <= numP; j++) {
                const distFromLow = j * purlinSpacing;
                const ratio = distFromLow / rafLen;

                // ratio=0 is low eaves (halfSpan), ratio=1 is high plate (-halfSpan)
                const pZ_on_slope = halfSpan - span * ratio;
                const pY_on_slope = h * ratio;

                const pY = pY_on_slope + offset * Math.cos(pitch);
                const pZ = pZ_on_slope + offset * Math.sin(pitch);

                elements.push(<Member key={`pur-${j}`} position={[0, pY, pZ]} rotation={[pitch, 0, 0]} args={[length, purlinSize, purlinSize]} color={c.purlin} />);
            }
        }

        // Covering
        if (covering !== "none" && visibility.covering) {
            const covOffset = 0.15 + (visibility.purlins ? 0.075 : 0);
            elements.push(
                <RoofPlane
                    key="cov"
                    position={[0, h / 2 + covOffset * Math.cos(pitch), covOffset * Math.sin(pitch)]}
                    rotation={[pitch + Math.PI / 2, 0, 0]}
                    args={[length, rafLen]}
                    color={coverCol}
                />
            );
        }

        // Rainwater Goods
        if (config.includeRainwaterGoods && visibility.rainwaterGoods) {
            // Gutter at low eaves side (halfSpan)
            elements.push(<Gutter key="gut-low" position={[0, -0.15, halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />);
            // Downpipes at 2 corners of low side
            const dpH = 4;
            [[-halfLen, halfSpan], [halfLen, halfSpan]].forEach(([x, z], i) => {
                elements.push(<Downpipe key={`dp-lt-${i}`} position={[x, -dpH / 2 - 0.15, z]} height={dpH} />);
            });
        }

        return elements;
    };

    const renderHipped = () => {
        const h = halfSpan * Math.tan(pitch);
        const elements = [];

        const ridgeLen = Math.max(0.1, buildingLength - buildingWidth);
        const hipOffset = (length - ridgeLen) / 2;

        // Wall Plates
        if (visibility.wallPlates) {
            elements.push(
                <Member key="wp-l" position={[0, 0, -halfSpan]} args={[length, 0.1, 0.1]} color={c.plate} />,
                <Member key="wp-r" position={[0, 0, halfSpan]} args={[length, 0.1, 0.1]} color={c.plate} />,
                <Member key="wp-f" position={[halfLen, 0, 0]} args={[0.1, 0.1, span]} color={c.plate} />,
                <Member key="wp-b" position={[-halfLen, 0, 0]} args={[0.1, 0.1, span]} color={c.plate} />
            );
        }

        // Ridge
        if (visibility.ridge) {
            elements.push(<Member key="ridge" position={[0, h, 0]} args={[ridgeLen, 0.2, 0.03]} color={c.ridge} />);
        }

        // Hips
        if (visibility.ridge) {
            const hipH = h;
            const hipX = hipOffset;
            const hipZ = halfSpan;
            const hipLen = Math.sqrt(hipH ** 2 + hipX ** 2 + hipZ ** 2);
            const hipPitch = Math.atan(h / Math.sqrt(hipX ** 2 + hipZ ** 2));
            const hipPlanAngle = Math.atan(hipZ / hipX);

            [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => {
                elements.push(
                    <group key={`hip-${i}`} position={[sx * ridgeLen / 2, h, 0]} rotation={[0, -sx * sz * hipPlanAngle + (sx < 0 ? Math.PI : 0), 0]}>
                        <Member position={[hipLen / 2, -h / 2, 0]} rotation={[0, 0, -hipPitch]} args={[hipLen, 0.15, 0.05]} color={c.ridge} />
                    </group>
                );
            });
        }

        // Common & Jack Rafters
        if (visibility.rafters) {
            const numRaf = Math.floor(length / rafterSpacing) + 1;
            for (let i = 0; i < numRaf; i++) {
                const x = -halfLen + i * rafterSpacing;
                const distFromCenter = Math.abs(x);
                const maxZAtX = (distFromCenter < ridgeLen / 2) ? halfSpan : Math.max(0, halfSpan - (distFromCenter - ridgeLen / 2));

                if (maxZAtX > 0) {
                    const rafL = maxZAtX / Math.cos(pitch);
                    const curH = maxZAtX * Math.tan(pitch);
                    elements.push(
                        <Member key={`raf-l-${i}`} position={[x, curH / 2, -maxZAtX / 2]} rotation={[-pitch, 0, 0]} args={[0.05, 0.15, rafL]} color={c.rafter} />,
                        <Member key={`raf-r-${i}`} position={[x, curH / 2, maxZAtX / 2]} rotation={[pitch, 0, 0]} args={[0.05, 0.15, rafL]} color={c.rafter} />
                    );
                }
            }
        }

        // Purlins (Corrected logic for hipped)
        if (visibility.purlins) {
            const purlinSpacing = 0.9;
            const rafLen = halfSpan / Math.cos(pitch);
            const numP = Math.floor(rafLen / purlinSpacing);
            const rafDepth = 0.15;
            const purlinSize = 0.05;
            const offset = (rafDepth / 2) + (purlinSize / 2);

            for (let j = 1; j <= numP; j++) {
                const ratio = (j * purlinSpacing) / rafLen;
                const pY = h * ratio + offset * Math.cos(pitch);
                const pZ_on_slope = halfSpan * (1 - ratio);
                const pZ_offset = offset * Math.sin(pitch);
                const curRidgeLen = ridgeLen + (1 - ratio) * (length - ridgeLen);

                elements.push(
                    <Member key={`pur-l-${j}`} position={[0, pY, -pZ_on_slope - pZ_offset]} rotation={[-pitch, 0, 0]} args={[curRidgeLen, purlinSize, purlinSize]} color={c.purlin} />,
                    <Member key={`pur-r-${j}`} position={[0, pY, pZ_on_slope + pZ_offset]} rotation={[pitch, 0, 0]} args={[curRidgeLen, purlinSize, purlinSize]} color={c.purlin} />
                );
            }
        }

        // Rainwater Goods
        if (config.includeRainwaterGoods && visibility.rainwaterGoods) {
            // Gutters all around
            elements.push(
                <Gutter key="gut-l" position={[0, -0.15, -halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />,
                <Gutter key="gut-r" position={[0, -0.15, halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />,
                <Gutter key="gut-f" position={[halfLen, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} length={span} />,
                <Gutter key="gut-b" position={[-halfLen, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} length={span} />
            );
            // Downpipes at 4 corners
            const dpH = 4;
            [[-halfLen, -halfSpan], [halfLen, -halfSpan], [-halfLen, halfSpan], [halfLen, halfSpan]].forEach(([x, z], i) => {
                elements.push(<Downpipe key={`dp-h-${i}`} position={[x, -dpH / 2 - 0.15, z]} height={dpH} />);
            });
        }

        return elements;
    };

    const renderGambrel = () => {
        const bw = halfSpan * breakRatio;
        const bh = bw * Math.tan(pitch2);
        const uw = halfSpan - bw;
        const uh = uw * Math.tan(pitch);
        const th = bh + uh;

        const lrLen = bw / Math.cos(pitch2);
        const urLen = uw / Math.cos(pitch);
        const elements = [];

        // Wall Plates
        if (visibility.wallPlates) {
            elements.push(
                <Member key="wp-l" position={[0, 0, -halfSpan]} args={[length, 0.1, 0.1]} color={c.plate} />,
                <Member key="wp-r" position={[0, 0, halfSpan]} args={[length, 0.1, 0.1]} color={c.plate} />
            );
        }

        if (visibility.rafters) {
            const numRaf = Math.floor(length / rafterSpacing) + 1;
            for (let i = 0; i < numRaf; i++) {
                const x = -halfLen + i * rafterSpacing;
                // Lower
                elements.push(<Member key={`ll-${i}`} position={[x, bh / 2, -halfSpan + bw / 2]} rotation={[-pitch2, 0, 0]} args={[0.05, 0.15, lrLen]} color={c.rafter} />);
                elements.push(<Member key={`lr-${i}`} position={[x, bh / 2, halfSpan - bw / 2]} rotation={[pitch2, 0, 0]} args={[0.05, 0.15, lrLen]} color={c.rafter} />);
                // Upper
                elements.push(<Member key={`ul-${i}`} position={[x, bh + uh / 2, -uw / 2]} rotation={[-pitch, 0, 0]} args={[0.05, 0.15, urLen]} color={c.rafter} />);
                elements.push(<Member key={`ur-${i}`} position={[x, bh + uh / 2, uw / 2]} rotation={[pitch, 0, 0]} args={[0.05, 0.15, urLen]} color={c.rafter} />);

                // Tie Beam at break
                elements.push(<Member key={`tie-${i}`} position={[x, bh, 0]} args={[0.05, 0.05, bw * 2]} color={c.plate} opacity={0.3} />);
            }
        }

        if (visibility.ridge) {
            elements.push(<Member key="ridge" position={[0, th, 0]} args={[length, 0.2, 0.03]} color={c.ridge} />);
        }

        // Purlins (Corrected for Gambrel)
        if (visibility.purlins) {
            const rafDepth = 0.15;
            const purlinSize = 0.05;
            const offset = (rafDepth / 2) + (purlinSize / 2);

            // 1. Lower slope purlins
            const numP_low = Math.floor(lrLen / 0.9);
            for (let j = 1; j <= numP_low; j++) {
                const ratio = (j * 0.9) / lrLen;
                const yRel = bh * (1 - ratio); // From break (ratio=0) to eaves (ratio=1)? 
                // Wait: ratio=0 is break, ratio=1 is eaves.
                const curY = bh * (1 - ratio);
                const curZ = halfSpan - bw * (1 - ratio);

                elements.push(
                    <Member key={`pur-low-l-${j}`} position={[0, curY + offset * Math.cos(pitch2), -curZ - offset * Math.sin(pitch2)]} rotation={[-pitch2, 0, 0]} args={[length, purlinSize, purlinSize]} color={c.purlin} />,
                    <Member key={`pur-low-r-${j}`} position={[0, curY + offset * Math.cos(pitch2), curZ + offset * Math.sin(pitch2)]} rotation={[pitch2, 0, 0]} args={[length, purlinSize, purlinSize]} color={c.purlin} />
                );
            }

            // 2. Upper slope purlins
            const numP_up = Math.floor(urLen / 0.9);
            for (let j = 1; j <= numP_up; j++) {
                const ratio = (j * 0.9) / urLen;
                const curY = bh + uh * ratio;
                const curZ = uw * (1 - ratio);

                elements.push(
                    <Member key={`pur-up-l-${j}`} position={[0, curY + offset * Math.cos(pitch), -curZ - offset * Math.sin(pitch)]} rotation={[-pitch, 0, 0]} args={[length, purlinSize, purlinSize]} color={c.purlin} />,
                    <Member key={`pur-up-r-${j}`} position={[0, curY + offset * Math.cos(pitch), curZ + offset * Math.sin(pitch)]} rotation={[pitch, 0, 0]} args={[length, purlinSize, purlinSize]} color={c.purlin} />
                );
            }

            // 3. Purlin exactly at break
            elements.push(
                <Member key="pur-b-l" position={[0, bh + offset, -halfSpan + bw]} args={[length, 0.1, 0.1]} color={c.purlin} />,
                <Member key="pur-b-r" position={[0, bh + offset, halfSpan - bw]} args={[length, 0.1, 0.1]} color={c.purlin} />
            );
        }

        // Rainwater Goods
        if (config.includeRainwaterGoods && visibility.rainwaterGoods) {
            elements.push(
                <Gutter key="gut-l" position={[0, -0.15, -halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />,
                <Gutter key="gut-r" position={[0, -0.15, halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />
            );
            const dpH = 4;
            [[-halfLen, -halfSpan], [halfLen, -halfSpan], [-halfLen, halfSpan], [halfLen, halfSpan]].forEach(([x, z], i) => {
                elements.push(<Downpipe key={`dp-g-${i}`} position={[x, -dpH / 2 - 0.15, z]} height={dpH} />);
            });
        }

        return elements;
    };

    const renderMansard = () => {
        // Hipped Gambrel
        const bw = halfSpan * breakRatio;
        const bh = bw * Math.tan(pitch2);

        const elements = [];

        // Simplified Mansard visualization (inherits Gambrel rafters)
        elements.push(...renderGambrel());

        // Add Hip rafters for the breaks
        if (visibility.ridge) {
            [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => {
                elements.push(
                    <Member key={`m-hip-${i}`} position={[sx * halfLen, bh / 2, sz * halfSpan]} rotation={[0, sx * sz * Math.PI / 4, sx * pitch2]} args={[bw * 1.414, 0.2, 0.05]} color={c.ridge} />
                );
            });
        }

        // Rainwater Goods (4 sides for mansard)
        if (config.includeRainwaterGoods && visibility.rainwaterGoods) {
            elements.push(
                <Gutter key="gut-l" position={[0, -0.15, -halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />,
                <Gutter key="gut-r" position={[0, -0.15, halfSpan]} rotation={[0, 0, Math.PI / 2]} length={length} />,
                <Gutter key="gut-f" position={[halfLen, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} length={span} />,
                <Gutter key="gut-b" position={[-halfLen, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]} length={span} />
            );
            const dpH = 4;
            [[-halfLen, -halfSpan], [halfLen, -halfSpan], [-halfLen, halfSpan], [halfLen, halfSpan]].forEach(([x, z], i) => {
                elements.push(<Downpipe key={`dp-m-${i}`} position={[x, -dpH / 2 - 0.15, z]} height={dpH} />);
            });
        }

        return elements;
    };

    const renderContent = () => {
        let base = [];
        switch (roofType) {
            case 'lean-to': base = renderLeanTo(); break;
            case 'hipped': base = renderHipped(); break;
            case 'gambrel': base = renderGambrel(); break;
            case 'mansard': base = renderMansard(); break;
            default: base = renderGable(); break;
        }

        // Add covering if not already handled and covering is selected
        if (covering !== "none" && visibility.covering && (roofType === 'hipped' || roofType === 'gambrel' || roofType === 'mansard')) {
            const h = halfSpan * Math.tan(pitch);
            const rafLen = halfSpan / Math.cos(pitch);
            // Basic planar covering for visualization
            base.push(
                <RoofPlane
                    key="cov-l-global"
                    position={[0, h / 2 + 0.15, -halfSpan / 2]}
                    rotation={[-pitch + Math.PI / 2, 0, 0]}
                    args={[length, rafLen]}
                    color={coverCol}
                    opacity={0.6}
                />,
                <RoofPlane
                    key="cov-r-global"
                    position={[0, h / 2 + 0.15, halfSpan / 2]}
                    rotation={[pitch + Math.PI / 2, 0, 0]}
                    args={[length, rafLen]}
                    color={coverCol}
                    opacity={0.6}
                />
            );
        }

        return base;
    };

    return (
        <group>
            {renderContent()}
            <gridHelper args={[20, 20, "#888", "#ddd"]} position={[0, -0.05, 0]} />
        </group>
    );
}

export default function Roof3DVisualizer({ config }) {
    const [visibility, setVisibility] = React.useState({
        rafters: true,
        purlins: true,
        wallPlates: true,
        covering: true,
        ridge: true,
        fascia: true,
        rainwaterGoods: true,
    });

    const toggleVisibility = (key) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="w-full h-full bg-slate-100 rounded-lg overflow-hidden shadow-inner relative">
            <Canvas shadows camera={{ position: [10, 10, 10], fov: 45 }}>
                <PerspectiveCamera makeDefault position={[12, 10, 12]} />
                <OrbitControls makeDefault />

                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[10, 20, 10]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />
                <pointLight position={[-10, 10, -10]} intensity={0.5} />
                <spotLight position={[0, 20, 0]} intensity={0.8} />

                <React.Suspense fallback={null}>
                    <RoofStructure config={config} visibility={visibility} />
                </React.Suspense>

                <Stats className="!absolute !top-auto !bottom-0 !left-0" />
            </Canvas>

            {/* UI Overlay */}
            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur p-4 rounded-xl shadow-lg border border-white/50 w-64 pointer-events-auto">
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-3 border-b pb-1">3D Controls</h3>

                <div className="space-y-2">
                    {Object.entries(visibility).map(([key, value]) => (
                        <label key={key} className="flex items-center justify-between cursor-pointer group">
                            <span className="text-xs font-medium text-slate-700 capitalize group-hover:text-blue-600 transition-colors">
                                {key.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <div
                                onClick={() => toggleVisibility(key)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-blue-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                            </div>
                        </label>
                    ))}
                </div>

                <div className="mt-4 pt-3 border-t">
                    <p className="text-[10px] text-slate-500 italic">Span: {config.buildingWidth}m | Pitch: {config.pitchAngle}°</p>
                    <p className="text-[10px] text-slate-500 italic">Type: {config.roofType}</p>
                </div>
            </div>
        </div>
    );
}
