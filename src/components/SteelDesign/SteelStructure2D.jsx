import React from 'react';
import { Line as KonvaLine, Rect as KonvaRect, Group, Path as KonvaPath } from 'react-konva';
import { getRoleColor } from './SteelBIM_Core.jsx';

const SteelStructure2D = ({ structure, viewMode, selectedIds = [], onSelect, isDark = false }) => {
    if (!structure) return null;

    const proj = (pt) => {
        // Higher scale for CAD (m to px) - adjust based on CAD zoom if needed
        const scale = 50;
        if (viewMode === 'top' || viewMode === 'plan') return { x: pt.x * scale, y: pt.y * scale };
        if (viewMode === 'right' || viewMode === 'side') return { x: pt.y * scale, y: -pt.z * scale };
        if (viewMode === 'front') return { x: pt.x * scale, y: -pt.z * scale };
        if (viewMode === 'iso') {
            return {
                x: (pt.x - pt.y * 0.5) * scale,
                y: (-pt.z - (pt.x + pt.y) * 0.2) * scale
            };
        }
        return { x: pt.x * scale, y: -pt.z * scale };
    };

    const renderMember = (mem) => {
        if (!mem.visible) return null;
        const s = proj(mem.start);
        const e = proj(mem.end);
        const isSelected = selectedIds.includes(mem.id);
        const color = getRoleColor(mem.role);

        // Simple line representation for 2D CAD
        return (
            <KonvaLine
                key={mem.id}
                points={[s.x, s.y, e.x, e.y]}
                stroke={isSelected ? '#3b82f6' : color}
                strokeWidth={isSelected ? 4 : 2}
                onClick={() => onSelect(mem.id)}
                lineCap="round"
            />
        );
    };

    const renderConnection = (conn) => {
        const p = proj(conn.position);
        const isSelected = selectedIds.includes(conn.id);
        const color = isSelected ? '#3b82f6' : '#94a3b8';

        if (conn.type === 'base_plate' || conn.type === 'bolted_end_plate') {
            const pw = (conn.plateW / 1000) * 50;
            const ph = (conn.plateH / 1000) * 50;
            return (
                <KonvaRect
                    key={conn.id}
                    x={p.x - pw / 2}
                    y={p.y - ph / 2}
                    width={pw}
                    height={ph}
                    fill={color + 'aa'}
                    stroke={color}
                    strokeWidth={1}
                    onClick={() => onSelect(conn.id)}
                />
            );
        }

        return null;
    };

    return (
        <Group>
            {structure.members.map(renderMember)}
            {structure.connections.map(renderConnection)}
        </Group>
    );
};

export default SteelStructure2D;
