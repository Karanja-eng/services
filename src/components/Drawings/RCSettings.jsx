import React from 'react';
import { Eye, Tag, Settings as SettingsIcon, Sun, Code } from 'lucide-react';

/**
 * Reinforced Concrete Settings Component
 * Extracted from StructuralVisualizationComponent for reusability
 */
export function RCSettings({
    showConcrete,
    setShowConcrete,
    showRebar,
    setShowRebar,
    showGrid,
    setShowGrid,
    showAxis,
    setShowAxis,
    showDimensions,
    setShowDimensions,
    showAnnotations,
    setShowAnnotations,
    colors,
    handleColorChange,
    wireframe,
    setWireframe,
    shadows,
    setShadows,
    antialiasing,
    setAntialiasing,
    snapToGrid,
    setSnapToGrid,
    ambientIntensity,
    setAmbientIntensity,
    directionalIntensity,
    setDirectionalIntensity,
    isDark = false,
}) {
    const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
    const bgSection = isDark ? 'bg-gray-750' : 'bg-gray-50';

    return (
        <div className="space-y-4">
            {/* Visibility Controls */}
            <section className={`p-3 rounded ${bgSection}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    Display Options
                </h3>
                <div className="space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Concrete</span>
                        <input
                            type="checkbox"
                            checked={showConcrete}
                            onChange={(e) => setShowConcrete(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Reinforcement</span>
                        <input
                            type="checkbox"
                            checked={showRebar}
                            onChange={(e) => setShowRebar(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Grid</span>
                        <input
                            type="checkbox"
                            checked={showGrid}
                            onChange={(e) => setShowGrid(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Axis</span>
                        <input
                            type="checkbox"
                            checked={showAxis}
                            onChange={(e) => setShowAxis(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Dimensions</span>
                        <input
                            type="checkbox"
                            checked={showDimensions}
                            onChange={(e) => setShowDimensions(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Annotations</span>
                        <input
                            type="checkbox"
                            checked={showAnnotations}
                            onChange={(e) => setShowAnnotations(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                </div>
            </section>

            {/* Color Customization */}
            <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    Material Colors
                </h3>
                <div className="space-y-3">
                    {Object.entries(colors).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                            <label className="text-xs capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                            <input
                                type="color"
                                value={value}
                                onChange={(e) => handleColorChange(key, e.target.value)}
                                className="w-10 h-8 rounded cursor-pointer border border-gray-600"
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Rendering Options */}
            <section className={`p-3 rounded ${bgSection}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Rendering
                </h3>
                <div className="space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Wireframe</span>
                        <input
                            type="checkbox"
                            checked={wireframe}
                            onChange={(e) => setWireframe(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Shadows</span>
                        <input
                            type="checkbox"
                            checked={shadows}
                            onChange={(e) => setShadows(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Anti-aliasing</span>
                        <input
                            type="checkbox"
                            checked={antialiasing}
                            onChange={(e) => setAntialiasing(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Snap to Grid</span>
                        <input
                            type="checkbox"
                            checked={snapToGrid}
                            onChange={(e) => setSnapToGrid(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                </div>
            </section>

            {/* Lighting Controls */}
            <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Sun className="w-4 h-4 mr-2" />
                    Lighting
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs block mb-1">
                            Ambient: {ambientIntensity.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={ambientIntensity}
                            onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="text-xs block mb-1">
                            Directional: {directionalIntensity.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={directionalIntensity}
                            onChange={(e) => setDirectionalIntensity(parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            </section>

            {/* Color Legend */}
            <section className={`p-3 rounded ${isDark ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'}`}>
                <h3 className="text-sm font-semibold mb-2">Color Legend</h3>
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center">
                        <div
                            className="w-4 h-4 rounded mr-2"
                            style={{ backgroundColor: colors.mainRebar }}
                        ></div>
                        <span>Main Reinforcement</span>
                    </div>
                    <div className="flex items-center">
                        <div
                            className="w-4 h-4 rounded mr-2"
                            style={{ backgroundColor: colors.stirrups }}
                        ></div>
                        <span>Stirrups/Links</span>
                    </div>
                    <div className="flex items-center">
                        <div
                            className="w-4 h-4 rounded mr-2"
                            style={{ backgroundColor: colors.distributionBars }}
                        ></div>
                        <span>Distribution Bars</span>
                    </div>
                    <div className="flex items-center">
                        <div
                            className="w-4 h-4 rounded mr-2 border"
                            style={{ backgroundColor: colors.concrete }}
                        ></div>
                        <span>Concrete</span>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default RCSettings;
