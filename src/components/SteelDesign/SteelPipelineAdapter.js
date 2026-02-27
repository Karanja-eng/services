import axios from 'axios';
import { StructuralElement } from '../ReinforcedConcrete/FramedandTall/StructuralClasses';

const STEEL_BACKEND_URL = 'http://localhost:8001'; // Standardized with main.py

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
 * Transforms pipeline results into StructuralElement instances
 * compatible with InteractiveStructureBuilder and StructuralCanvas.
 * @param {object} results - Pipeline execution results
 * @returns {object} Transformed data for builder
 */
export const transformPipelineResults = (results) => {
    if (!results || !results.success || !results.members) return null;

    // Backend generates coordinates in millimeters - canvas uses meters
    const MM_TO_M = 1 / 1000;

    const elements = results.members.map(m => {
        const rawType = String(m.type || m.member_type || 'unknown').toLowerCase();

        // Normalize to the 5 types StructuralCanvas understands
        let type = 'beam';
        if (rawType.includes('column') || rawType.includes('leg')) {
            type = 'column';
        }
        // Everything else (rafter, chord, web, diagonal, purlin, bracing...) → beam

        const cl = m.centerline || {};
        const rawStart = cl.start || { x: 0, y: 0, z: 0 };
        const rawEnd = cl.end || { x: rawStart.x, y: rawStart.y, z: rawStart.z };

        // Convert from mm → m
        const start = {
            x: (rawStart.x || 0) * MM_TO_M,
            y: (rawStart.y || 0) * MM_TO_M,
            z: (rawStart.z || 0) * MM_TO_M
        };
        const end = {
            x: (rawEnd.x || 0) * MM_TO_M,
            y: (rawEnd.y || 0) * MM_TO_M,
            z: (rawEnd.z || 0) * MM_TO_M
        };

        // Build position the way StructuralElement expects it
        // Columns: { x, y, z }  Beams: { start, end }
        const position = type === 'column' ? start : { start, end };

        // Section data (depths & widths are in mm in backend - convert to m for properties panel)
        const sec = m.section || {};
        const depthM = (sec.depth || 300) * MM_TO_M;
        const widthM = (sec.width || sec.flange_width || 150) * MM_TO_M;
        const heightM = Math.abs(end.z - start.z) || 3.5;

        // Create a proper StructuralElement instance so getBounds(), selected, visible all work
        const el = new StructuralElement(
            type,
            String(m.id || m.mark || `m_${Math.random().toString(36).substr(2, 6)}`),
            position,
            {
                width: widthM,
                depth: depthM,
                height: heightM,
                material: m.grade || 'S275',
                section: sec.designation || 'Unknown',
                mass_per_meter: sec.mass_per_meter || 0,
                layer: 'Floor 1'  // all steel members go to Floor 1
            }
        );

        // Attach steel-specific analysis data if available
        const mid = m.id || m.mark;
        el.analysis_data = Array.isArray(results.analysis_results)
            ? results.analysis_results.find(r => r.element_id === mid)
            : results.analysis_results?.[mid];

        el.design_data =
            results.design_results?.beams?.find(r => r.id === mid)?.results ||
            results.design_results?.columns?.find(r => r.id === mid)?.results;

        return el;
    });

    return {
        elements,
        nodes: results.nodes || [],
        drawing_data: results.drawing_data || {
            '3d': results.draw_3d || [],
            '2d': results.draw_2d || []
        },
        analysis_results: results.analysis_results,
        design_results: results.design_results
    };
};
