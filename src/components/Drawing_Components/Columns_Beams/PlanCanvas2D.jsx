import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Group, Line, Rect, Text } from 'react-konva'
import Column2D, { ColumnGridLines } from '../columns/Column2D'
import Beam2D from '../beams/Beam2D'
import { useStore } from '../../store'

const PLAN_ORIGIN = { x: 80, y: 80 }

export default function PlanCanvas2D({ width, height }) {
    const {
        columns, beams,
        selectedId, setSelectedId,
        activeTool, addColumn, addBeam, setBeamStart, beamStart,
        planScale,
    } = useStore()

    const stageRef = useRef(null)
    const [hoverPos, setHoverPos] = useState(null)

    // Convert canvas px to world metres
    const toWorld = useCallback((px, py) => ({
        x: (px - PLAN_ORIGIN.x) / planScale,
        y: (py - PLAN_ORIGIN.y) / planScale,
    }), [planScale])

    // Convert world metres to canvas px
    const toPlan = useCallback((wx, wy) => ({
        x: PLAN_ORIGIN.x + wx * planScale,
        y: PLAN_ORIGIN.y + wy * planScale,
    }), [planScale])

    // Snap to nearest 0.25m grid
    const snap = (v) => Math.round(v / 0.25) * 0.25

    const handleStageClick = useCallback((e) => {
        if (activeTool !== 'place_column' && activeTool !== 'place_beam') {
            setSelectedId(null)
            return
        }
        const pos = e.target.getStage().getPointerPosition()
        const world = toWorld(pos.x, pos.y)
        const wx = snap(world.x), wy = snap(world.y)

        if (activeTool === 'place_column') {
            addColumn(wx, wy)
        }
    }, [activeTool, addColumn, toWorld, setSelectedId])

    const handleMouseMove = useCallback((e) => {
        const pos = e.target.getStage().getPointerPosition()
        const world = toWorld(pos.x, pos.y)
        setHoverPos({ x: snap(world.x), y: snap(world.y) })
    }, [toWorld])

    const handleColumnClick = useCallback((col) => (e) => {
        e.cancelBubble = true
        if (activeTool === 'place_beam') {
            if (!beamStart) {
                setBeamStart(col.id)
                setSelectedId(col.id)
            } else {
                addBeam(beamStart, col.id)
                setBeamStart(null)
                setSelectedId(null)
            }
        } else {
            setSelectedId(col.id)
        }
    }, [activeTool, beamStart, setBeamStart, addBeam, setSelectedId])

    // Snap grid overlay
    const snapLines = []
    for (let i = 0; i * planScale < width; i++) {
        const x = PLAN_ORIGIN.x + i * planScale * 0.25
        snapLines.push(x)
    }

    const cursor = activeTool === 'place_column' ? 'crosshair'
        : activeTool === 'place_beam' ? 'cell'
            : 'default'

    return (
        <div className="w-full h-full" style={{ cursor }}>
            <Stage
                ref={stageRef}
                width={width} height={height}
                onClick={handleStageClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverPos(null)}
                style={{ background: '#070e1a' }}
            >
                {/* Background layer */}
                <Layer>
                    {/* Blueprint grid */}
                    {Array.from({ length: Math.ceil(width / planScale) + 1 }, (_, i) => (
                        <Line key={`vl-${i}`}
                            points={[PLAN_ORIGIN.x + i * planScale, 0, PLAN_ORIGIN.x + i * planScale, height]}
                            stroke="#1a2d4a" strokeWidth={0.5}
                        />
                    ))}
                    {Array.from({ length: Math.ceil(height / planScale) + 1 }, (_, i) => (
                        <Line key={`hl-${i}`}
                            points={[0, PLAN_ORIGIN.y + i * planScale, width, PLAN_ORIGIN.y + i * planScale]}
                            stroke="#1a2d4a" strokeWidth={0.5}
                        />
                    ))}

                    {/* Finer snap grid */}
                    {Array.from({ length: Math.ceil(width / (planScale * 0.25)) + 1 }, (_, i) => (
                        <Line key={`vls-${i}`}
                            points={[PLAN_ORIGIN.x + i * planScale * 0.25, 0, PLAN_ORIGIN.x + i * planScale * 0.25, height]}
                            stroke="#111e30" strokeWidth={0.3}
                        />
                    ))}
                </Layer>

                {/* Grid lines + bubbles */}
                <Layer>
                    <ColumnGridLines
                        columns={columns}
                        canvasW={width} canvasH={height}
                        planOrigin={PLAN_ORIGIN}
                        scale={planScale}
                    />
                </Layer>

                {/* Beams layer */}
                <Layer>
                    {beams.map((beam) => {
                        const sc = columns.find(c => c.id === beam.startColId)
                        const ec = columns.find(c => c.id === beam.endColId)
                        if (!sc || !ec) return null
                        const sp = toPlan(sc.x, sc.y)
                        const ep = toPlan(ec.x, ec.y)
                        return (
                            <Beam2D
                                key={beam.id}
                                type={beam.type}
                                startX={sp.x} startY={sp.y}
                                endX={ep.x} endY={ep.y}
                                sectionProps={beam.sectionProps}
                                scale={planScale}
                                material={beam.material}
                                selected={selectedId === beam.id}
                                onClick={(e) => { e.cancelBubble = true; setSelectedId(beam.id) }}
                            />
                        )
                    })}
                </Layer>

                {/* Columns layer */}
                <Layer>
                    {columns.map((col) => {
                        const pos = toPlan(col.x, col.y)
                        return (
                            <Column2D
                                key={col.id}
                                type={col.type}
                                x={pos.x} y={pos.y}
                                sectionProps={col.sectionProps}
                                scale={planScale}
                                material={col.material}
                                gridRef={col.gridRef}
                                selected={selectedId === col.id}
                                onClick={handleColumnClick(col)}
                            />
                        )
                    })}
                </Layer>

                {/* Ghost preview for placement */}
                {(activeTool === 'place_column' || activeTool === 'place_beam') && hoverPos && (
                    <Layer listening={false}>
                        {(() => {
                            const pos = toPlan(hoverPos.x, hoverPos.y)
                            return (
                                <Group x={pos.x} y={pos.y} opacity={0.5}>
                                    <Rect x={-15} y={-15} width={30} height={30}
                                        fill="transparent" stroke="#4a9eff" strokeWidth={1} dash={[4, 3]} />
                                    <Line points={[-8, 0, 8, 0]} stroke="#4a9eff" strokeWidth={1} />
                                    <Line points={[0, -8, 0, 8]} stroke="#4a9eff" strokeWidth={1} />
                                </Group>
                            )
                        })()}
                    </Layer>
                )}

                {/* Beam start indicator */}
                {beamStart && (() => {
                    const sc = columns.find(c => c.id === beamStart)
                    if (!sc) return null
                    const pos = toPlan(sc.x, sc.y)
                    return (
                        <Layer listening={false}>
                            <Group x={pos.x} y={pos.y}>
                                <Line points={[-20, -20, 20, 20]} stroke="#f39c12" strokeWidth={2} />
                                <Line points={[20, -20, -20, 20]} stroke="#f39c12" strokeWidth={2} />
                            </Group>
                            {hoverPos && (() => {
                                const hp = toPlan(hoverPos.x, hoverPos.y)
                                return (
                                    <Line
                                        points={[pos.x, pos.y, hp.x, hp.y]}
                                        stroke="#f39c12" strokeWidth={1} dash={[6, 4]} opacity={0.6}
                                    />
                                )
                            })()}
                        </Layer>
                    )
                })()}

                {/* Coordinates HUD */}
                {hoverPos && (
                    <Layer listening={false}>
                        <Rect x={8} y={height - 28} width={180} height={20}
                            fill="#0a1628" opacity={0.8} cornerRadius={2} />
                        <Text
                            x={12} y={height - 24}
                            text={`X: ${hoverPos.x.toFixed(2)}m  Y: ${hoverPos.y.toFixed(2)}m`}
                            fontSize={10} fontFamily="JetBrains Mono, monospace" fill="#4a9eff"
                        />
                    </Layer>
                )}
            </Stage>
        </div>
    )
}