import axios from 'axios';

const STEEL_BACKEND_URL = 'http://localhost:8000'; // Adjust as needed

/**
 * Calls the unified Steel BIM Pipeline (Generation -> Analysis -> Design -> Drawing)
 * @param {string} generator - Name of the generator (e.g., 'truss')
 * @param {object} params - Parameters for the generator
 * @param {string} analysisMethod - Analysis method (default: 'matrix_stiffness')
 * @returns {Promise<object>} The full BIM model with analysis and design results
 */
export const runSteelPipeline = async (generator, params, analysisMethod = 'matrix_stiffness') => {
    try {
        console.log(`Running Steel Pipeline: ${generator}`, params);
        const response = await axios.post(`${STEEL_BACKEND_URL}/api/steel_structure/pipeline/run`, {
            generator,
            params,
            analysis_method: analysisMethod,
            design_code: 'BS5950'
        });
        return response.data;
    } catch (error) {
        console.error('Steel Pipeline execution failed:', error);
        throw error;
    }
};

/**
 * Transforms pipeline results for InteractiveStructureBuilder
 * @param {object} results - Pipeline execution results
 * @returns {object} Transformed data for builder
 */
export const transformPipelineResults = (results) => {
    if (!results.success) return null;

    // Map members to builder elements
    const elements = results.members.map(m => ({
        id: m.id || m.mark,
        type: m.member_type.toLowerCase(),
        start: m.centerline.start,
        end: m.centerline.end,
        properties: {
            section: m.section.designation,
            material: m.grade,
            mass: m.section.mass_per_meter,
            ...m.section
        },
        analysis_data: results.analysis_results?.find(r => r.element_id === (m.id || m.mark)),
        design_data: results.design_results?.beams?.find(r => r.id === (m.id || m.mark))?.results ||
            results.design_results?.columns?.find(r => r.id === (m.id || m.mark))?.results
    }));

    return {
        elements,
        nodes: results.nodes,
        drawing_data: results.drawing_data
    };
};
