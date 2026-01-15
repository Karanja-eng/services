import React from 'react';

export const SectionView = ({ type, width, depth, reinforcement, cover = 25 }) => {
    // SVG Scaling
    const scale = 200 / Math.max(width, depth);
    const w = width * scale;
    const h = depth * scale;
    const c = cover * scale;

    // Parse reinforcement data
    // Expected format: { tension_bars: { number: 3, size: "H20" }, ... }

    const renderBars = (count, yPos, color = "#cc3333") => {
        if (!count) return null;
        const bars = [];
        const spacing = (w - 2 * c) / (count + 1);

        for (let i = 1; i <= count; i++) {
            bars.push(
                <circle
                    key={i}
                    cx={c + i * spacing}
                    cy={yPos}
                    r={4} // Fixed radius for visual
                    fill={color}
                    stroke="black"
                    strokeWidth="1"
                />
            );
        }
        return bars;
    };

    return (
        <div className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold mb-2">Section Detail</h3>
            <svg width={w + 40} height={h + 40} viewBox={`-20 -20 ${w + 40} ${h + 40}`}>
                {/* Concrete Section */}
                <rect x="0" y="0" width={w} height={h} fill="#e5e7eb" stroke="#374151" strokeWidth="2" />

                {/* Stirrups / Links */}
                <rect
                    x={c} y={c}
                    width={w - 2 * c} height={h - 2 * c}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    rx="5"
                />

                {/* Beam Reinforcement */}
                {type === 'beam' && (
                    <>
                        {/* Bottom (Tension) */}
                        {renderBars(reinforcement.tension_bars?.number || 0, h - c - 5)}
                        {/* Top (Compression/Hanger) */}
                        {renderBars(reinforcement.compression_bars?.number || 2, c + 5, "#ef4444")}
                    </>
                )}

                {/* Column Reinforcement */}
                {type === 'column' && (
                    <>
                        {/* Distributed around perimeter approx */}
                        {/* For simple rect column, place top/bottom intermediate side bars? */}
                        {/* Simplified: Top and Bottom rows for now */}
                        {renderBars(Math.ceil((reinforcement.number_of_bars || 4) / 2), c + 5)}
                        {renderBars(Math.floor((reinforcement.number_of_bars || 4) / 2), h - c - 5)}
                    </>
                )}

                {/* Dimensions */}
                <text x={w / 2} y={-5} textAnchor="middle" fontSize="12" fill="currentColor">{width} mm</text>
                <text x={-5} y={h / 2} textAnchor="middle" transform={`rotate(-90, -5, ${h / 2})`} fontSize="12" fill="currentColor">{depth} mm</text>
            </svg>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <p>Cover: {cover} mm</p>
                <p>Main Steel: {reinforcement.bar_size || "Calculated"}</p>
            </div>
        </div>
    );
};
