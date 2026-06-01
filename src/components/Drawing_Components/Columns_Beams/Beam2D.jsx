import React from 'react'
import { Group, Line, Text, Rect, Arrow } from 'react-konva'
import { beamPlanRect, dimensionLine, toPixels } from './drawing2d.js'
import { MATERIAL_FILL_2D } from './sectionLibraryData.js'

// Dimension line with span label
function SpanDimension({ x1, y1, x2, y2, spanM, scale }) {
    const dim = dimensionLine(x1, y1, x2, y2, 22)
    const label = `L = ${spanM.toFixed(2)}m`
    return (
        <Group>
            <Line points={dim.linePoints} stroke="#f39c12" strokeWidth={1} />
            <Line points={dim.tickLeft} stroke="#f39c12" strokeWidth={1} />
            <Line points={dim.tickRight} stroke="#f39c12" strokeWidth={1} />
            {/* Arrow heads */}
            <Arrow
                points={[dim.linePoints[2], dim.linePoints[3], dim.linePoints[0], dim.linePoints[1]]}
                fill="#f39c12" stroke="#f39c12" strokeWidth={1}
                pointerLength={6} pointerWidth={4}
            />
            <Arrow
                points={[dim.linePoints[0], dim.linePoints[1], dim.linePoints[2], dim.linePoints[3]]}
                fill="#f39c12" stroke="#f39c12" strokeWidth={1}
                pointerLength={6} pointerWidth={4}
            />
            <Text
                x={dim.midX - 40} y={dim.midY - 10}
                text={label}
                fontSize={9}
                fontFamily="JetBrains Mono, monospace"
                fill="#f39c12"
                align="center"
                width={80}
            />
        </Group>
    )
}

// Section mark indicator
function SectionMark({ x, y, ref: sRef = 'A-A' }) {
    return (
        <Group>
            <Line points={[x - 15, y, x + 15, y]} stroke="#e74c3c" strokeWidth={1.5} />
            <Line points={[x - 15, y - 8, x - 15, y + 8]} stroke="#e74c3c" strokeWidth={1.5} />
            <Line points={[x + 15, y - 8, x + 15, y + 8]} stroke="#e74c3c" strokeWidth={1.5} />
            <Text x={x + 18} y={y - 6} text={sRef} fontSize={8}
                fontFamily="JetBrains Mono, monospace" fill="#e74c3c" />
        </Group>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// BEAM 2D COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Beam2D({
    type = 'rectangular_beam',
    startX, startY,
    endX, endY,
    sectionProps = {},
    scale = 60,
    material = 'concrete',
    selected = false,
    showDimension = true,
    onClick,
}) {
    const fill = MATERIAL_FILL_2D[material] || MATERIAL_FILL_2D.concrete
    const beamWidth = sectionProps.width || sectionProps.bw || sectionProps.B || 0.3
    const bwPx = toPixels(beamWidth, scale)

    const dx = endX - startX, dy = endY - startY
    const spanPx = Math.sqrt(dx * dx + dy * dy)
    const spanM = spanPx / scale

    const rectPoints = beamPlanRect(startX, startY, endX, endY, beamWidth, scale)
    const stroke = selected ? '#4a9eff' : fill.stroke
    const sw = selected ? 2 : 1

    // Beam type label
    const typeLabels = {
        rectangular_beam: 'RC', t_beam: 'T', l_beam: 'L',
        steel_i_beam: 'UB', steel_channel: 'PFC', steel_hollow_beam: 'RHS',
        timber_beam: 'TBR', pt_beam: 'PT', cantilever_beam: 'CANT', transfer_beam: 'XFER',
    }
    const beamLabel = typeLabels[type] || 'B'

    // Mid-point for label
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2
    const angle = Math.atan2(dy, dx) * 180 / Math.PI

    return (
        <Group onMouseDown={onClick}>
            {/* Beam outline (dashed = hidden below slab) */}
            <Line
                points={rectPoints}
                closed
                fill={selected ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.03)'}
                stroke={stroke}
                strokeWidth={sw}
                dash={[6, 4]}
            />

            {/* Centre line */}
            <Line
                points={[startX, startY, endX, endY]}
                stroke={stroke} strokeWidth={0.5} opacity={0.5}
                dash={[10, 5]}
            />

            {/* Beam label at mid-span */}
            <Text
                x={midX - 20} y={midY - 6}
                text={beamLabel}
                fontSize={8}
                fontFamily="JetBrains Mono, monospace"
                fill={fill.stroke}
                rotation={angle > 90 || angle < -90 ? angle + 180 : angle}
                offsetX={-20}
            />

            {/* Span dimension */}
            {showDimension && (
                <SpanDimension
                    x1={startX} y1={startY}
                    x2={endX} y2={endY}
                    spanM={spanM} scale={scale}
                />
            )}
        </Group>
    )
}