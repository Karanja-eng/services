import React, { useCallback, useState } from 'react';
import InteractiveStructureBuilder from '../ReinforcedConcrete/FramedandTall/InteractiveStructureBuilder';
import { callSteelAnalysis, callSteelDesign, prepareAnalysisPayload, prepareDesignPayload } from './SteelStructureAdapter';
import { runSteelPipeline, transformPipelineResults } from './SteelPipelineAdapter';

/**
 * Steel Structure Builder Wrapper
 * Wraps the RC InteractiveStructureBuilder and provides steel-specific handlers
 * 
 * This component:
 * - Receives steel configuration from parent (steel grade, default sections)
 * - Overrides analysis handler to call steel backend
 * - Overrides design handler to call steel backend
 * - Passes everything else through to RC builder unchanged
 */
const SteelStructureBuilderWrapper = ({
    steelGrade = 'S275',
    defaultBeamSection = '305x165x54',
    defaultColumnSection = '203x203x60',
    sectionDisplayType = 'I-section',
    isFullScreen = false,
    onFullScreenChange
}) => {
    const [elements, setElements] = useState([]);

    /**
     * Custom analysis handler for steel structures
     * Transforms elements and calls steel analysis backend
     */
    const handleSteelAnalysis = useCallback(async (builderElements, method) => {
        try {
            console.log('Running steel analysis with:', {
                steelGrade,
                defaultBeamSection,
                defaultColumnSection,
                elementCount: builderElements.length,
                method
            });

            // Prepare payload with steel properties
            const payload = prepareAnalysisPayload(
                builderElements,
                steelGrade,
                defaultBeamSection,
                defaultColumnSection,
                method
            );

            // Call steel analysis backend
            const results = await callSteelAnalysis(payload.elements, payload.method);

            console.log('Steel analysis complete:', results);
            return results;
        } catch (error) {
            console.error('Steel analysis error:', error);
            throw error;
        }
    }, [steelGrade, defaultBeamSection, defaultColumnSection]);

    /**
     * Custom design handler for steel structures
     * Transforms elements and calls steel design backend
     */
    const handleSteelDesign = useCallback(async (builderElements) => {
        try {
            console.log('Running steel design with:', {
                steelGrade,
                defaultBeamSection,
                defaultColumnSection,
                elementCount: builderElements.length
            });

            // Prepare payload with steel properties and analysis results
            const payload = prepareDesignPayload(
                builderElements,
                steelGrade,
                defaultBeamSection,
                defaultColumnSection
            );

            // Call steel design backend
            const results = await callSteelDesign(payload.elements);

            console.log('Steel design complete:', results);
            return results;
        } catch (error) {
            console.error('Steel design error:', error);
            throw error;
        }
    }, [steelGrade, defaultBeamSection, defaultColumnSection]);

    /**
     * Custom template selector for steel systems (trusses, etc.)
     */
    const handleTemplateSelect = useCallback(async (template) => {
        if (template.structural_system === 'steel_truss') {
            try {
                // Run the full BIM pipeline for the truss
                const results = await runSteelPipeline('truss', {
                    truss_type: template.bay_config.truss_type,
                    span: template.bay_config.span * 1000,
                    depth: template.bay_config.depth * 1000,
                    num_panels: template.bay_config.num_panels,
                    pitch_angle: template.bay_config.pitch_angle,
                    grade: steelGrade,
                    top_chord_section: defaultBeamSection,
                    bottom_chord_section: defaultBeamSection,
                    web_section: defaultBeamSection // Simplified for now
                });

                const transformed = transformPipelineResults(results);
                return transformed;
            } catch (error) {
                console.error('Failed to generate steel system:', error);
                throw error;
            }
        }
        return null; // Fallback to RC default logic
    }, [steelGrade, defaultBeamSection]);

    return (
        <InteractiveStructureBuilder
            isFullScreen={isFullScreen}
            onFullScreenChange={onFullScreenChange}
            customAnalysisHandler={handleSteelAnalysis}
            customDesignHandler={handleSteelDesign}
            customTemplateHandler={handleTemplateSelect}
            materialType="steel"
            sectionDisplayType={sectionDisplayType}
        />
    );
};

export default SteelStructureBuilderWrapper;
