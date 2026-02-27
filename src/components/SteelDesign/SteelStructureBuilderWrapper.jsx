import React, { useCallback, useState } from 'react';
import InteractiveStructureBuilder from '../ReinforcedConcrete/FramedandTall/InteractiveStructureBuilder';
import { callSteelAnalysis, callSteelDesign, prepareAnalysisPayload, prepareDesignPayload } from './SteelStructureAdapter';
import { runSteelPipeline } from './SteelPipelineAdapter';
import { transformSteelResults } from './Steelsystemrenderer';
import SteelElevationCanvas from './Steelsystemrenderer';
import { STRUCTURE_REGISTRY } from './SteelBIM_Generators';
import { StructuralElement } from '../ReinforcedConcrete/FramedandTall/StructuralClasses';

/**
 * Helper to convert local SteelElement objects into Analytical StructuralElement instances
 */
function transformLocalSteelMembers(members, category) {
    if (!members) return [];
    return members.map((m, idx) => {
        const type = (m.role === 'column' || m.role === 'leg') ? 'column' : 'beam';

        // Analytical position for 2D Plan view (Z collapsed to 0)
        const position2D = type === 'column'
            ? { x: m.start.x, y: m.start.y, z: 0 }
            : {
                start: { x: m.start.x, y: m.start.y, z: 0 },
                end: { x: m.end.x, y: m.end.y, z: 0 }
            };

        const depth = (m.meta?.depth || 300) / 1000;
        const width = (m.meta?.width || 150) / 1000;

        return new StructuralElement(
            type,
            String(m.id || `m_${idx}`),
            position2D,
            {
                width,
                depth,
                height: m.length || 3.5,
                material: m.material || 'S275',
                section: m.section || 'Unknown',
                layer: 'Floor 1',
                generatorName: category,
                // Keep 3D coords for 3D visualization and Elevation SVG
                start3D: m.start,
                end3D: m.end
            }
        );
    });
}

/**
 * Steel Structure Builder Wrapper
 * Wraps the RC InteractiveStructureBuilder with steel-specific handlers.
 *
 * - Analysis uses /api/framed_full/analyze-full → returns sections[] for BMD/SFD
 * - Template selection uses the BIM pipeline generator → transformSteelResults
 * - Shows a SteelElevationCanvas (SVG side-view) below the main canvas when a
 *   steel template is active.
 */
const SteelStructureBuilderWrapper = ({
    steelGrade = 'S275',
    defaultBeamSection = '305x165x54',
    defaultColumnSection = '203x203x60',
    sectionDisplayType = 'I-section',
    isFullScreen = false,
    onFullScreenChange
}) => {
    // Elevation state: stores the last template elements + name for the SVG panel
    const [elevationState, setElevationState] = useState(null); // { elements, title }

    /**
     * Custom analysis handler — uses the RC framed endpoint so it returns
     * element_id / N_max / M_max / V_max / sections[] needed by BMD/SFD renderer.
     */
    const handleSteelAnalysis = useCallback(async (builderElements, method) => {
        try {
            const payload = prepareAnalysisPayload(
                builderElements,
                steelGrade,
                defaultBeamSection,
                defaultColumnSection,
                method
            );
            // Returns a flat array compatible with the diagram renderer
            return await callSteelAnalysis(payload.elements, method);
        } catch (error) {
            console.error('Steel analysis error:', error);
            throw error;
        }
    }, [steelGrade, defaultBeamSection, defaultColumnSection]);

    /**
     * Custom design handler — uses full BIM pipeline for steel.
     */
    const handleSteelDesign = useCallback(async (builderElements) => {
        try {
            const payload = prepareDesignPayload(
                builderElements,
                steelGrade,
                defaultBeamSection,
                defaultColumnSection
            );
            return await callSteelDesign(payload.elements);
        } catch (error) {
            console.error('Steel design error:', error);
            throw error;
        }
    }, [steelGrade, defaultBeamSection, defaultColumnSection]);

    /**
     * Custom template selector for steel systems (trusses, portals, towers, bridges).
     * Runs the BIM pipeline, converts members with transformSteelResults, and
     * stores the elevation data so the SVG panel can render.
     */
    const handleTemplateSelect = useCallback(async (template) => {
        const STEEL_SYSTEMS = [
            'steel_truss', 'portal_frame', 'portal_frame_dual', 'truss',
            'house_truss', 'bridge', 'lattice_tower',
            'north_light', 'north_light_shed', 'plate_girder', 'plate_girder_frame', 'dome'
        ];

        if (!STEEL_SYSTEMS.includes(template.structural_system)) {
            return null; // Let the RC builder handle it normally
        }

        try {
            const bay = template.bay_config || {};

            // Resolve the generator category
            const categoryMap = {
                'steel_truss': 'trusses',
                'truss': 'trusses',
                'house_truss': 'trusses',
                'portal_frame': 'portals',
                'portal_frame_dual': 'portals',
                'bridge': 'bridges',
                'lattice_tower': 'towers',
                'north_light': 'trusses',
                'dome': 'domes'
            };

            const category = categoryMap[template.structural_system] || 'trusses';
            const genId = bay.generator || 'default';

            // PREFER LOCAL HIGH-FIDELITY BIM GENERATOR IF AVAILABLE
            if (STRUCTURE_REGISTRY[category]) {
                const templates = STRUCTURE_REGISTRY[category];
                // Try to find specific generator or use the first one as default
                const templateDef = templates.find(t => t.id === genId) || templates[0];
                const generatorFunction = templateDef.gen;
                const bimResult = generatorFunction({ ...templateDef.cfg, ...bay });

                if (bimResult && bimResult.members) {
                    const transformedElements = transformLocalSteelMembers(bimResult.members, category);

                    // Update elevation panel with local results
                    setElevationState({
                        elements: transformedElements,
                        title: `${template.name || templateDef.label} — Elevation View`.toUpperCase(),
                        generatorName: templateDef.id,
                    });

                    return {
                        elements: transformedElements,
                        connections: bimResult.connections || [],
                        nodes: bimResult.nodes || [],
                        analysis_results: null,
                        design_results: null
                    };
                }
            }

            // FALLBACK TO BACKEND GENERATORS FOR OTHERS
            const params = {
                ...bay,
                grade: steelGrade,
                span: (bay.span || 12) * 1000,
                depth: (bay.depth || bay.eave_height || 6) * 1000,
                ridge_height: (bay.ridge_height || 3) * 1000,
                eave_height: (bay.eave_height || 6) * 1000,
                total_height: (bay.total_height || 30) * 1000,
                bay_spacing: (bay.bay_spacing || 6) * 1000,
                top_chord_section: defaultBeamSection,
                bottom_chord_section: defaultBeamSection,
                web_section: defaultBeamSection,
            };

            // Run the full BIM pipeline (generation → analysis → design → drawing)
            const rawResults = await runSteelPipeline(category, params);

            // Convert backend members into StructuralElement instances
            const { elements } = transformSteelResults(rawResults, category);

            // Update the elevation SVG panel
            setElevationState({
                elements,
                title: `${template.name || category} — Elevation View`.toUpperCase(),
                generatorName: category,
            });

            return {
                elements,
                nodes: rawResults.nodes || [],
                drawing_data: rawResults.drawing_data || {},
                analysis_results: rawResults.analysis_results,
                design_results: rawResults.design_results,
            };
        } catch (error) {
            console.error('Failed to generate steel system:', error);
            throw error;
        }
    }, [steelGrade, defaultBeamSection]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
            {/* Main interactive builder — takes all available height */}
            <div style={{ flex: 1, minHeight: 0 }}>
                <InteractiveStructureBuilder
                    isFullScreen={isFullScreen}
                    onFullScreenChange={onFullScreenChange}
                    customAnalysisHandler={handleSteelAnalysis}
                    customDesignHandler={handleSteelDesign}
                    customTemplateHandler={handleTemplateSelect}
                    materialType="steel"
                    sectionDisplayType={sectionDisplayType}
                />
            </div>

            {/* Elevation SVG panel — only shown when a steel template has been loaded */}
            {elevationState && (
                <div style={{
                    borderTop: '2px solid #2c3e50',
                    background: '#f8f9fa',
                    padding: '12px 16px',
                    overflowX: 'auto',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8
                    }}>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#2c3e50',
                            letterSpacing: 1,
                            textTransform: 'uppercase'
                        }}>
                            📐 Structural Elevation
                        </span>
                        <button
                            onClick={() => setElevationState(null)}
                            style={{
                                background: 'none',
                                border: '1px solid #ccc',
                                borderRadius: 4,
                                padding: '2px 8px',
                                cursor: 'pointer',
                                fontSize: 11,
                                color: '#666'
                            }}
                        >
                            ✕ Hide
                        </button>
                    </div>
                    <SteelElevationCanvas
                        elements={elevationState.elements}
                        title={elevationState.title}
                        width={900}
                        height={380}
                    />
                </div>
            )}
        </div>
    );
};

export default SteelStructureBuilderWrapper;
