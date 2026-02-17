/**
 * Steel Structure Adapter
 * Transforms data between Structure Builder and steel design backend
 */

import axios from 'axios';

const STEEL_BACKEND_URL = 'http://127.0.0.1:8001';

/**
 * Transform Structure Builder elements for steel analysis
 * Adds steel-specific properties (grade, section type)
 */
export const transformElementsForSteelAnalysis = (elements, steelGrade, defaultBeamSection, defaultColumnSection) => {
    return elements.map(el => {
        const section = el.type === 'beam' ? defaultBeamSection :
            el.type === 'column' ? defaultColumnSection : null;
        const sectionType = el.type === 'beam' ? 'UB' :
            el.type === 'column' ? 'UC' : null;

        return {
            ...el,
            properties: {
                ...el.properties,
                material: steelGrade,
                section: section,
                sectionType: sectionType
            }
        };
    });
};

/**
 * Call steel structure analysis endpoint
 * Returns analysis results in same format as RC analysis
 */
export const callSteelAnalysis = async (elements, method = 'moment_distribution') => {
    try {
        const response = await axios.post(`${STEEL_BACKEND_URL}/api/steel_structure/analyze-full`, {
            elements,
            method,
            slab_load: 5.0
        });
        return response.data;
    } catch (error) {
        console.error('Steel analysis failed:', error);
        throw error;
    }
};

/**
 * Call steel structure design endpoint
 * Returns design results in DesignDashboard format
 */
export const callSteelDesign = async (elements) => {
    try {
        const response = await axios.post(`${STEEL_BACKEND_URL}/api/steel_structure/run-design`, {
            elements
        });
        return response.data;
    } catch (error) {
        console.error('Steel design failed:', error);
        throw error;
    }
};

/**
 * Prepare payload for steel analysis
 * Converts Structure Builder format to backend format
 */
export const prepareAnalysisPayload = (elements, steelGrade, defaultBeamSection, defaultColumnSection, method = 'moment_distribution') => {
    const transformedElements = transformElementsForSteelAnalysis(
        elements,
        steelGrade,
        defaultBeamSection,
        defaultColumnSection
    );

    return {
        elements: transformedElements.map(el => {
            const payload = {
                id: el.id,
                type: el.type,
                properties: {
                    width: el.properties?.width || 0.3,
                    depth: el.properties?.depth || 0.3,
                    height: el.properties?.height || 3.5,
                    material: el.properties?.material || steelGrade,
                    section: el.properties?.section,
                    sectionType: el.properties?.sectionType,
                    load_combined: el.properties?.load || 0
                },
                layer: el.layer || 'Floor 1'
            };

            // Add position data based on element type
            if (el.type === 'beam' || el.type === 'wall') {
                payload.start = el.position?.start || { x: 0, y: 0, z: 0 };
                payload.end = el.position?.end || { x: 5, y: 0, z: 0 };
            } else if (el.type === 'column') {
                const pos = el.position || { x: 0, y: 0, z: 0 };
                const h = el.properties?.height || 3.5;
                payload.start = { x: pos.x, y: pos.y, z: pos.z };
                payload.end = { x: pos.x, y: pos.y, z: pos.z + h };
            } else {
                payload.position = el.position || { x: 0, y: 0, z: 0 };
            }

            return payload;
        }),
        method,
        slab_load: 5.0
    };
};

/**
 * Prepare payload for steel design
 * Includes analysis results for each element
 */
export const prepareDesignPayload = (elements, steelGrade, defaultBeamSection, defaultColumnSection) => {
    const transformedElements = transformElementsForSteelAnalysis(
        elements,
        steelGrade,
        defaultBeamSection,
        defaultColumnSection
    );

    return {
        elements: transformedElements.map(el => {
            const payload = {
                id: el.id,
                type: el.type,
                properties: {
                    width: el.properties?.width || 0.3,
                    depth: el.properties?.depth || 0.3,
                    height: el.properties?.height || 3.5,
                    material: el.properties?.material || steelGrade,
                    section: el.properties?.section,
                    sectionType: el.properties?.sectionType,
                    load_combined: el.properties?.load || 0
                },
                layer: el.layer || 'Floor 1',
                analysisResults: el.analysisResults || null
            };

            // Add position data
            if (el.type === 'beam' || el.type === 'wall') {
                payload.start = el.position?.start || { x: 0, y: 0, z: 0 };
                payload.end = el.position?.end || { x: 5, y: 0, z: 0 };
            } else if (el.type === 'column') {
                const pos = el.position || { x: 0, y: 0, z: 0 };
                const h = el.properties?.height || 3.5;
                payload.start = { x: pos.x, y: pos.y, z: pos.z };
                payload.end = { x: pos.x, y: pos.y, z: pos.z + h };
            } else {
                payload.position = el.position || { x: 0, y: 0, z: 0 };
            }

            return payload;
        })
    };
};

export default {
    transformElementsForSteelAnalysis,
    callSteelAnalysis,
    callSteelDesign,
    prepareAnalysisPayload,
    prepareDesignPayload
};
