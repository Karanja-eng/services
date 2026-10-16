import axios from 'axios';

const STEEL_BACKEND_URL = 'http://localhost:8001'; // Standard port for this project

/**
 * Calls the unified Steel BIM Pipeline V2
 */
export const runSteelPipelineV2 = async (generator, params, analysisMethod = 'matrix_stiffness') => {
    try {
        console.log(`Running Steel Pipeline V2 (Rigorous): ${generator}`, params);
        const response = await axios.post(`${STEEL_BACKEND_URL}/api/steel_structure/pipeline/run`, {
            generator,
            params,
            analysis_method: analysisMethod,
            design_code: 'BS5950_v2' // Using the rigorous V2 engine
        });
        return response.data;
    } catch (error) {
        console.error('Steel Pipeline V2 execution failed:', error);
        throw error;
    }
};

/**
 * Call standalone rigorous beam design
 */
export const runAdvancedBeamDesign = async (beamData) => {
    try {
        const response = await axios.post(`${STEEL_BACKEND_URL}/api/steel_structure/v2/beam-design`, beamData);
        return response.data;
    } catch (error) {
        console.error('Advanced beam design failed:', error);
        throw error;
    }
};

/**
 * Transforms pipeline results for InteractiveStructureBuilder
 */
export const transformPipelineResultsV2 = (results) => {
    if (!results || !results.members) return null;

    // Map members to builder elements with detailed design data
    const elements = results.members.map(m => {
        const memberId = m.id || m.mark;

        // Find design data in specialized buckets
        const beamDesign = results.design_results?.beams?.find(r => r.id === memberId);
        const columnDesign = results.design_results?.columns?.find(r => r.id === memberId);
        const strutDesign = results.design_results?.struts?.find(r => r.id === memberId);
        const tieDesign = results.design_results?.ties?.find(r => r.id === memberId);

        const designData = beamDesign?.results || columnDesign?.results || strutDesign || tieDesign;

        return {
            id: memberId,
            type: m.member_type?.toLowerCase() || 'beam',
            start: m.centerline?.start,
            end: m.centerline?.end,
            properties: {
                section: m.section?.designation,
                material: m.grade,
                mass: m.section?.mass_per_meter,
                ...m.section
            },
            analysis_data: results.analysis_results?.find(r => r.element_id === memberId),
            design_data: designData,
            isAdvanced: true
        };
    });

    return {
        elements,
        nodes: results.nodes,
        drawing_data: results.drawing_data,
        summary: results.design_results?.summary,
        connections: results.connection_results?.connections
    };
};

export default {
    runSteelPipelineV2,
    runAdvancedBeamDesign,
    transformPipelineResultsV2
};
