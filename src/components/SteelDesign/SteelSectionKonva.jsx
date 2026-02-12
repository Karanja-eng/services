import React from 'react';
import { Group, Rect, Line } from 'react-konva';

/**
 * Steel Section Konva Components
 * Renders I-sections, H-sections, and circular sections for steel members
 * Based on BS 5950 typical proportions
 */

/**
 * I-Section Column (UC - Universal Column) - Top view
 * Shows flanges and web from above
 * 
 * Typical UC proportions:
 * - Flange width ≈ depth (square-ish profile)
 * - Web thickness ≈ depth/15
 * - Flange thickness ≈ depth/10
 */
export const ISectionColumn = ({
    x,
    y,
    width,
    depth,
    fill = '#708090',
    stroke = '#2F4F4F',
    strokeWidth = 1
}) => {
    const flangeWidth = depth; // UC has wide flanges
    const webThickness = depth / 15;
    const flangeThickness = depth / 10;

    return (
        <Group x={x} y={y}>
            {/* Top flange */}
            <Rect
                x={-flangeWidth / 2}
                y={-width / 2}
                width={flangeWidth}
                height={flangeThickness}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            {/* Web (vertical) */}
            <Rect
                x={-webThickness / 2}
                y={-width / 2 + flangeThickness}
                width={webThickness}
                height={width - 2 * flangeThickness}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            {/* Bottom flange */}
            <Rect
                x={-flangeWidth / 2}
                y={width / 2 - flangeThickness}
                width={flangeWidth}
                height={flangeThickness}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            {/* Center lines for visual clarity */}
            <Line
                points={[0, -width / 2, 0, width / 2]}
                stroke={stroke}
                strokeWidth={0.5}
                opacity={0.3}
                dash={[2, 2]}
            />
            <Line
                points={[-flangeWidth / 2, 0, flangeWidth / 2, 0]}
                stroke={stroke}
                strokeWidth={0.5}
                opacity={0.3}
                dash={[2, 2]}
            />
        </Group>
    );
};

/**
 * I-Section Beam (UB - Universal Beam) - Side elevation
 * Shows flanges and web from side
 * 
 * Typical UB proportions:
 * - Flange width ≈ 0.5-0.6 × depth (narrower than UC)
 * - Web thickness ≈ depth/15
 * - Flange thickness ≈ depth/10
 */
export const ISectionBeam = ({
    x,
    y,
    length,
    depth,
    rotation = 0,
    fill = '#708090',
    stroke = '#2F4F4F',
    strokeWidth = 1,
    opacity = 1.0
}) => {
    const flangeThickness = depth / 10;
    const webThickness = depth / 20;

    return (
        <Group x={x} y={y} rotation={rotation} opacity={opacity}>
            {/* Top flange (full length) */}
            <Rect
                x={0}
                y={-depth / 2}
                width={length}
                height={flangeThickness}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            {/* Web (centered, thinner, slightly transparent) */}
            <Rect
                x={0}
                y={-depth / 2 + flangeThickness}
                width={length}
                height={depth - 2 * flangeThickness}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth * 0.7}
                opacity={0.8}
            />

            {/* Bottom flange (full length) */}
            <Rect
                x={0}
                y={depth / 2 - flangeThickness}
                width={length}
                height={flangeThickness}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            {/* Flange edge lines for definition */}
            <Line
                points={[0, -depth / 2, length, -depth / 2]}
                stroke={stroke}
                strokeWidth={strokeWidth * 1.5}
            />
            <Line
                points={[0, depth / 2, length, depth / 2]}
                stroke={stroke}
                strokeWidth={strokeWidth * 1.5}
            />

            {/* Web-to-flange junction lines (fillet representation) */}
            <Line
                points={[0, -depth / 2 + flangeThickness, length, -depth / 2 + flangeThickness]}
                stroke={stroke}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.5}
            />
            <Line
                points={[0, depth / 2 - flangeThickness, length, depth / 2 - flangeThickness]}
                stroke={stroke}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.5}
            />
        </Group>
    );
};

/**
 * Rectangular Section (for RC or rectangular hollow sections)
 */
export const RectangularSection = ({
    x,
    y,
    width,
    height,
    fill = '#708090',
    stroke = '#2F4F4F',
    strokeWidth = 1,
    rotation = 0
}) => {
    return (
        <Rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rotation={rotation}
        />
    );
};

/**
 * Circular/Tubular Section (CHS - Circular Hollow Section)
 */
export const CircularSection = ({
    x,
    y,
    diameter,
    fill = '#708090',
    stroke = '#2F4F4F',
    strokeWidth = 1
}) => {
    return (
        <Group x={x} y={y}>
            {/* Outer circle */}
            <Rect
                x={-diameter / 2}
                y={-diameter / 2}
                width={diameter}
                height={diameter}
                cornerRadius={diameter / 2}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            {/* Inner circle (hollow) - represented by lighter fill */}
            <Rect
                x={-diameter / 2 + diameter / 10}
                y={-diameter / 2 + diameter / 10}
                width={diameter * 0.8}
                height={diameter * 0.8}
                cornerRadius={diameter * 0.4}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={strokeWidth * 0.5}
                opacity={0.3}
            />
        </Group>
    );
};

/**
 * Get steel section color based on utilization ratio
 */
export const getSteelSectionColor = (utilization) => {
    if (!utilization) return '#708090'; // Slate gray (default)

    if (utilization < 0.5) return '#4CAF50'; // Green - underutilized
    if (utilization < 0.8) return '#FFC107'; // Amber - moderate
    if (utilization < 1.0) return '#FF9800'; // Orange - high
    return '#F44336'; // Red - overstressed
};

export default {
    ISectionColumn,
    ISectionBeam,
    RectangularSection,
    CircularSection,
    getSteelSectionColor
};
