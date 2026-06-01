import React from 'react'
import { Group, Rect, Circle, Line, Text, RegularPolygon } from 'react-konva'
import { columnPlanPoints, toPixels } from './drawing2d.js'
import { MATERIAL_FILL_2D } from './sectionLibraryData.js'

// RC diagonal hatch fill (using clip + lines)
function RCHatch({ x, y, width, height, color }) {
    const lines = []
    const spacing = 6
    const total = (width + height) / spacing
    for (let i = -total; i < total; i++) {
        const x1 = x + i * spacing
        const y1 = y
        lines.push({ points: [x1, y1, x1 + height, y1 + height] })
    }
    return (
        <Group clipX={x} clipY={y} clipWidth={width} clipHeight={height}>
            {lines.map((l, i) => (
                <Line key={i} points={l.points} stroke={color} strokeWidth={0.5} opacity={0.5} />
            ))}
        </Group>
    )
}

// Grid bubble
function GridBubble({ x, y, label, size = 16 }) {
    return (
        <Group>
            <Circle x={x} y={y} radius={size} fill="transparent" stroke="#4a9eff" strokeWidth={1} />
            <Text
                x={x - size} y={y - size}
                width={size * 2} height={size * 2}
                text={label}
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fill="#4a9eff"
                align="center"
                verticalAlign="middle"
            />
        </Group>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN 2D COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Column2D({
    type = 'rectangular_rc',
    x = 0,
    y = 0,
    sectionProps = {},
    scale = 60,
    material = 'concrete',
    gridRef = '',
    showGridBubble = false,
    selected = false,
    onClick,
}) {
    const fill = MATERIAL_FILL_2D[material] || MATERIAL_FILL_2D.concrete
    const planPt = columnPlanPoints(type, sectionProps, scale)
    const stroke = selected ? '#4a9eff' : fill.stroke
    const sw = selected ? 2 : 1
    const bubbleOffset = 30

    const renderShape = () => {
        switch (planPt.shape) {
            case 'rect':
                return (
                    <Group>
                        <Rect
                            x={planPt.x} y={planPt.y}
                            width={planPt.width} height={planPt.height}
                            fill={fill.fill} stroke={stroke} strokeWidth={sw}
                        />
                        {fill.hatch === 'rc' && (
                            <RCHatch
                                x={planPt.x} y={planPt.y}
                                width={planPt.width} height={planPt.height}
                                color={fill.stroke}
                            />
                        )}
                    </Group>
                )

            case 'circle':
                return (
                    <Group>
                        <Circle radius={planPt.radius} fill={fill.fill} stroke={stroke} strokeWidth={sw} />
                        {fill.hatch === 'rc' && (
                            <RCHatch
                                x={-planPt.radius} y={-planPt.radius}
                                width={planPt.radius * 2} height={planPt.radius * 2}
                                color={fill.stroke}
                            />
                        )}
                    </Group>
                )

            case 'polygon':
                return (
                    <Group>
                        <Line
                            points={planPt.points}
                            closed fill={fill.fill} stroke={stroke} strokeWidth={sw}
                        />
                        {fill.hatch === 'solid' && (
                            <Line
                                points={planPt.points}
                                closed fill={fill.fill} stroke={stroke} strokeWidth={sw}
                            />
                        )}
                    </Group>
                )

            case 'hollow_rect':
                return (
                    <Group>
                        <Rect
                            x={planPt.outer.x} y={planPt.outer.y}
                            width={planPt.outer.w} height={planPt.outer.h}
                            fill={fill.fill} stroke={stroke} strokeWidth={sw}
                        />
                        <Rect
                            x={planPt.inner.x} y={planPt.inner.y}
                            width={planPt.inner.w} height={planPt.inner.h}
                            fill="#0a1628" stroke={stroke} strokeWidth={0.5}
                        />
                    </Group>
                )

            default:
                return <Rect x={-20} y={-20} width={40} height={40} fill={fill.fill} stroke={stroke} strokeWidth={sw} />
        }
    }

    return (
        <Group x={x} y={y} onMouseDown={onClick}>
            {renderShape()}

            {/* Grid cross-hair */}
            <Line points={[-6, 0, 6, 0]} stroke="#4a9eff" strokeWidth={0.5} opacity={0.4} />
            <Line points={[0, -6, 0, 6]} stroke="#4a9eff" strokeWidth={0.5} opacity={0.4} />

            {/* Grid ref label */}
            {gridRef && (
                <Text
                    x={5} y={-14}
                    text={gridRef}
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                    fill="#4a9eff"
                />
            )}

            {/* Selected indicator */}
            {selected && (
                <Circle radius={4} fill="#4a9eff" opacity={0.8} />
            )}
        </Group>
    )
}

// Column grid lines component
export function ColumnGridLines({ columns, canvasW, canvasH, planOrigin, scale }) {
    if (!columns || columns.length < 2) return null

    // Find unique X and Y positions → grid lines
    const xs = [...new Set(columns.map(c => c.x))].sort((a, b) => a - b)
    const ys = [...new Set(columns.map(c => c.y))].sort((a, b) => a - b)

    const toX = (worldX) => planOrigin.x + worldX * scale
    const toY = (worldY) => planOrigin.y + worldY * scale
    const bubbleR = 16

    return (
        <Group>
            {/* Vertical grid lines (same world X) */}
            {xs.map((wx, i) => {
                const px = toX(wx)
                return (
                    <Group key={`vgl-${i}`}>
                        <Line
                            points={[px, bubbleR * 2, px, canvasH - bubbleR * 2]}
                            stroke="#4a9eff" strokeWidth={0.5} opacity={0.25}
                            dash={[8, 6]}
                        />
                        <GridBubble x={px} y={bubbleR} label={`${i + 1}`} size={bubbleR} />
                        <GridBubble x={px} y={canvasH - bubbleR} label={`${i + 1}`} size={bubbleR} />
                    </Group>
                )
            })}

            {/* Horizontal grid lines (same world Y) */}
            {ys.map((wy, i) => {
                const py = toY(wy)
                const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || `${i}`
                return (
                    <Group key={`hgl-${i}`}>
                        <Line
                            points={[bubbleR * 2, py, canvasW - bubbleR * 2, py]}
                            stroke="#4a9eff" strokeWidth={0.5} opacity={0.25}
                            dash={[8, 6]}
                        />
                        <GridBubble x={bubbleR} y={py} label={letter} size={bubbleR} />
                        <GridBubble x={canvasW - bubbleR} y={py} label={letter} size={bubbleR} />
                    </Group>
                )
            })}
        </Group>
    )
}