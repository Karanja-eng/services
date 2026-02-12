import React from 'react';
import { Group, Rect, Line, Text } from 'react-konva';

/**
 * Steel Section Renderer - Renders I-sections and H-sections for steel members
 * Used in 2D CAD views to show steel cross-sections with flanges and webs
 */

/**
 * Render an I-section (Universal Beam) in 2D
 * @param {Object} section - Steel section properties {depth, width, tw, tf}
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} scale - Scale factor for rendering
 * @param {string} color - Fill color
 * @param {boolean} showDimensions - Whether to show dimension labels
 */
export const IBeamSection2D = ({
    section,
    x = 0,
    y = 0,
    scale = 1,
    color = '#4A90E2',
    showDimensions = false,
    rotation = 0
}) => {
    if (!section) return null;

    const { depth, width, tw, tf } = section;

    // Scale dimensions for rendering (convert mm to pixels)
    const scaledDepth = depth * scale;
    const scaledWidth = width * scale;
    const scaledTw = tw * scale;
    const scaledTf = tf * scale;

    // Calculate web height
    const webHeight = scaledDepth - 2 * scaledTf;

    return (
        <Group x={x} y={y} rotation={rotation}>
            {/* Top Flange */}
            <Rect
                x={-scaledWidth / 2}
                y={-scaledDepth / 2}
                width={scaledWidth}
                height={scaledTf}
                fill={color}
                stroke="#2C3E50"
                strokeWidth={0.5}
            />

            {/* Web */}
            <Rect
                x={-scaledTw / 2}
                y={-scaledDepth / 2 + scaledTf}
                width={scaledTw}
                height={webHeight}
                fill={color}
                stroke="#2C3E50"
                strokeWidth={0.5}
            />

            {/* Bottom Flange */}
            <Rect
                x={-scaledWidth / 2}
                y={scaledDepth / 2 - scaledTf}
                width={scaledWidth}
                height={scaledTf}
                fill={color}
                stroke="#2C3E50"
                strokeWidth={0.5}
            />

            {/* Dimension labels */}
            {showDimensions && (
                <>
                    <Text
                        x={scaledWidth / 2 + 5}
                        y={-scaledDepth / 2}
                        text={`D=${depth}mm`}
                        fontSize={10}
                        fill="#333"
                    />
                    <Text
                        x={-scaledWidth / 2}
                        y={-scaledDepth / 2 - 15}
                        text={`B=${width}mm`}
                        fontSize={10}
                        fill="#333"
                    />
                </>
            )}
        </Group>
    );
};

/**
 * Render an H-section (Universal Column) in 2D
 * Similar to I-beam but typically with wider flanges relative to depth
 */
export const HColumnSection2D = ({
    section,
    x = 0,
    y = 0,
    scale = 1,
    color = '#E74C3C',
    showDimensions = false,
    rotation = 0
}) => {
    // H-sections use same geometry as I-sections, just different proportions
    return (
        <IBeamSection2D
            section={section}
            x={x}
            y={y}
            scale={scale}
            color={color}
            showDimensions={showDimensions}
            rotation={rotation}
        />
    );
};

/**
 * Render a steel beam in elevation view (side view showing I-section)
 */
export const SteelBeamElevation = ({
    startX,
    startY,
    endX,
    endY,
    section,
    color = '#4A90E2',
    showSection = true,
    label = ''
}) => {
    const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

    return (
        <Group>
            {/* Beam centerline */}
            <Line
                points={[startX, startY, endX, endY]}
                stroke={color}
                strokeWidth={2}
            />

            {/* I-section at start */}
            {showSection && section && (
                <>
                    <IBeamSection2D
                        section={section}
                        x={startX}
                        y={startY}
                        scale={0.05}
                        color={color}
                        rotation={angle + 90}
                    />
                    <IBeamSection2D
                        section={section}
                        x={endX}
                        y={endY}
                        scale={0.05}
                        color={color}
                        rotation={angle + 90}
                    />
                </>
            )}

            {/* Label */}
            {label && (
                <Text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 15}
                    text={label}
                    fontSize={12}
                    fill="#333"
                    fontStyle="bold"
                />
            )}
        </Group>
    );
};

/**
 * Render a steel column in elevation view
 */
export const SteelColumnElevation = ({
    x,
    y,
    height,
    section,
    color = '#E74C3C',
    showSection = true,
    label = ''
}) => {
    return (
        <Group>
            {/* Column centerline */}
            <Line
                points={[x, y, x, y - height]}
                stroke={color}
                strokeWidth={2}
            />

            {/* H-section at top and bottom */}
            {showSection && section && (
                <>
                    <HColumnSection2D
                        section={section}
                        x={x}
                        y={y}
                        scale={0.05}
                        color={color}
                    />
                    <HColumnSection2D
                        section={section}
                        x={x}
                        y={y - height}
                        scale={0.05}
                        color={color}
                    />
                </>
            )}

            {/* Label */}
            {label && (
                <Text
                    x={x + 10}
                    y={y - height / 2}
                    text={label}
                    fontSize={12}
                    fill="#333"
                    fontStyle="bold"
                />
            )}
        </Group>
    );
};

/**
 * Get section color based on utilization ratio
 */
export const getSectionColor = (utilizationRatio) => {
    if (utilizationRatio > 1.0) return '#E74C3C'; // Red - overstressed
    if (utilizationRatio > 0.9) return '#F39C12'; // Orange - near limit
    if (utilizationRatio > 0.7) return '#F1C40F'; // Yellow - moderate
    return '#27AE60'; // Green - safe
};

/**
 * Render steel section properties panel
 */
export const SteelSectionProperties = ({ section, designation }) => {
    if (!section) return null;

    return (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">
                {designation || 'Steel Section Properties'}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">Depth (D):</div>
                <div className="font-semibold">{section.depth} mm</div>

                <div className="text-gray-600">Width (B):</div>
                <div className="font-semibold">{section.width} mm</div>

                <div className="text-gray-600">Web Thickness (tw):</div>
                <div className="font-semibold">{section.tw} mm</div>

                <div className="text-gray-600">Flange Thickness (tf):</div>
                <div className="font-semibold">{section.tf} mm</div>

                <div className="text-gray-600">Area:</div>
                <div className="font-semibold">{section.area} cm²</div>

                <div className="text-gray-600">Ix:</div>
                <div className="font-semibold">{section.Ix} cm⁴</div>

                <div className="text-gray-600">Iy:</div>
                <div className="font-semibold">{section.Iy} cm⁴</div>
            </div>
        </div>
    );
};

export default {
    IBeamSection2D,
    HColumnSection2D,
    SteelBeamElevation,
    SteelColumnElevation,
    getSectionColor,
    SteelSectionProperties
};
