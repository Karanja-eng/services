import React from 'react'
import { useStore } from '../../store'
import { COLUMN_TYPES, BEAM_TYPES } from '../../data/sectionLibrary'

// SVG cross-section icons for each type
function SectionIcon({ icon, material, size = 28 }) {
    const colors = {
        concrete: { fill: '#6b7280', stroke: '#374151' },
        steel: { fill: '#7A8B8B', stroke: '#374151' },
        timber: { fill: '#c9a87c', stroke: '#92400e' },
        composite: { fill: '#8899aa', stroke: '#374151' },
    }
    const c = colors[material] || colors.concrete
    const s = size

    switch (icon) {
        case 'rect':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <rect x={5} y={5} width={18} height={18} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                    {material === 'concrete' && <>
                        <line x1={5} y1={5} x2={23} y2={23} stroke={c.stroke} strokeWidth={0.5} opacity={0.5} />
                        <line x1={9} y1={5} x2={23} y2={19} stroke={c.stroke} strokeWidth={0.5} opacity={0.5} />
                        <line x1={5} y1={9} x2={19} y2={23} stroke={c.stroke} strokeWidth={0.5} opacity={0.5} />
                    </>}
                </svg>
            )
        case 'circle':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <circle cx={14} cy={14} r={10} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                    {material === 'concrete' && <>
                        <line x1={7} y1={7} x2={21} y2={21} stroke={c.stroke} strokeWidth={0.5} opacity={0.4} />
                    </>}
                </svg>
            )
        case 'I':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <polygon
                        points="4,4 24,4 24,8 17,8 17,20 24,20 24,24 4,24 4,20 11,20 11,8 4,8"
                        fill={c.fill} stroke={c.stroke} strokeWidth={1.5}
                    />
                </svg>
            )
        case 'L':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <polygon points="4,4 11,4 11,20 24,20 24,24 4,24"
                        fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                </svg>
            )
        case 'T':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <polygon points="4,4 24,4 24,9 17,9 17,24 11,24 11,9 4,9"
                        fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                </svg>
            )
        case 'hollow':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <rect x={4} y={4} width={20} height={20} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                    <rect x={8} y={8} width={12} height={12} fill="#070e1a" stroke={c.stroke} strokeWidth={0.5} />
                </svg>
            )
        case 'timber':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <rect x={5} y={4} width={18} height={20} fill="#c9a87c" stroke="#92400e" strokeWidth={1.5} />
                    {[8, 12, 16, 20].map((y) => (
                        <line key={y} x1={5} y1={y} x2={23} y2={y} stroke="#8B6914" strokeWidth={0.5} />
                    ))}
                </svg>
            )
        case 'composite':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <circle cx={14} cy={14} r={10} fill="#9ca3af" stroke="#374151" strokeWidth={1.5} />
                    <polygon
                        points="14,7 17,7 17,11 19,11 19,21 9,21 9,11 11,11 11,7"
                        fill="#7A8B8B" stroke="#374151" strokeWidth={1}
                    />
                </svg>
            )
        case 'classical':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <ellipse cx={14} cy={14} rx={10} ry={12} fill="#e8e0d0" stroke="#374151" strokeWidth={1.5} />
                    <line x1={4} y1={22} x2={24} y2={22} stroke="#374151" strokeWidth={1.5} />
                    <line x1={4} y1={6} x2={24} y2={6} stroke="#374151" strokeWidth={1.5} />
                </svg>
            )
        case 'C':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <polygon points="6,4 22,4 22,9 11,9 11,19 22,19 22,24 6,24"
                        fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                </svg>
            )
        case 'pt':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <rect x={4} y={6} width={20} height={16} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                    <path d="M4,18 Q14,10 24,18" fill="none" stroke="#f39c12" strokeWidth={1.5} />
                </svg>
            )
        case 'cant':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <polygon points="4,6 24,12 24,24 4,24"
                        fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                </svg>
            )
        case 'transfer':
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <rect x={4} y={6} width={20} height={16} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                    <text x={14} y={17} textAnchor="middle" fontSize={7} fill={c.stroke} fontWeight="bold">XFER</text>
                </svg>
            )
        default:
            return (
                <svg width={s} height={s} viewBox="0 0 28 28">
                    <rect x={6} y={6} width={16} height={16} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                </svg>
            )
    }
}

export default function SectionLibrary() {
    const {
        activeTool,
        selectedColumnType, setSelectedColumnType,
        selectedBeamType, setSelectedBeamType,
        setActiveTool,
    } = useStore()

    const isColumnMode = activeTool === 'place_column' || activeTool === 'select'
    const isBeamMode = activeTool === 'place_beam'

    return (
        <div className="panel flex flex-col h-full overflow-hidden">
            <div className="panel-header">Section Library</div>

            {/* Mode tabs */}
            <div className="flex border-b border-blueprint-line">
                <button
                    className={`flex-1 py-1.5 text-xs font-mono tracking-wider transition-colors ${!isBeamMode ? 'text-blueprint-accent border-b-2 border-blueprint-accent' : 'text-blueprint-bright opacity-60'
                        }`}
                    onClick={() => setActiveTool('place_column')}
                >
                    COLUMNS
                </button>
                <button
                    className={`flex-1 py-1.5 text-xs font-mono tracking-wider transition-colors ${isBeamMode ? 'text-blueprint-accent border-b-2 border-blueprint-accent' : 'text-blueprint-bright opacity-60'
                        }`}
                    onClick={() => setActiveTool('place_beam')}
                >
                    BEAMS
                </button>
            </div>

            <div className="overflow-y-auto flex-1 p-2">
                {!isBeamMode ? (
                    <div className="grid grid-cols-3 gap-1.5">
                        {COLUMN_TYPES.map((ct) => (
                            <button
                                key={ct.id}
                                className={`type-card ${selectedColumnType === ct.id ? 'active' : ''}`}
                                onClick={() => setSelectedColumnType(ct.id)}
                                title={ct.label}
                            >
                                <SectionIcon icon={ct.icon} material={ct.material} />
                                <span className="text-xs font-mono text-blueprint-bright leading-tight">
                                    {ct.label}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                        {BEAM_TYPES.map((bt) => (
                            <button
                                key={bt.id}
                                className={`type-card ${selectedBeamType === bt.id ? 'active' : ''}`}
                                onClick={() => setSelectedBeamType(bt.id)}
                                title={bt.label}
                            >
                                <SectionIcon icon={bt.icon} material={bt.material} />
                                <span className="text-xs font-mono text-blueprint-bright leading-tight">
                                    {bt.label}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}