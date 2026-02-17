/**
 * Steel Analysis Adapter
 * Transforms frame analysis results into steel design API requests
 * Bridges the gap between structural analysis and member design
 */

import axios from 'axios';

const API_BASE_URL = "http://localhost:8001/steel_backend";

/**
 * Extract maximum moment and shear for a member from analysis results
 * @param {Object} analysisResults - Frame analysis results
 * @param {string} memberId - Member identifier
 * @returns {Object} {maxMoment, maxShear, momentDiagram, shearDiagram}
 */
export function extractMemberForces(analysisResults, memberId) {
    if (!analysisResults || !analysisResults.diagrams) {
        return { maxMoment: 0, maxShear: 0 };
    }

    // Find the diagram for this member
    const memberDiagram = analysisResults.diagrams.find(
        d => d.span === parseInt(memberId) || d.member_id === memberId
    );

    if (!memberDiagram || !memberDiagram.points) {
        return { maxMoment: 0, maxShear: 0 };
    }

    // Extract max absolute values
    const moments = memberDiagram.points.map(p => Math.abs(parseFloat(p.M) || 0));
    const shears = memberDiagram.points.map(p => Math.abs(parseFloat(p.V) || 0));

    return {
        maxMoment: Math.max(...moments),
        maxShear: Math.max(...shears),
        momentDiagram: memberDiagram.points.map(p => ({ x: p.x, M: p.M })),
        shearDiagram: memberDiagram.points.map(p => ({ x: p.x, V: p.V }))
    };
}

/**
 * Prepare beam design request from analysis results
 * @param {Object} member - Member object {id, type, length, section, sectionType}
 * @param {Object} forces - {maxMoment, maxShear}
 * @param {string} steelGrade - Steel grade (S275, S355, S450)
 * @returns {Object} Beam design request payload
 */
export function prepareBeamDesignRequest(member, forces, steelGrade = 'S275') {
    // Convert moment from kNm to equivalent UDL
    // For simply supported beam: M_max = wL²/8, so w = 8M/L²
    const span = member.length || 6.0; // meters
    const equivalentUDL = (8 * forces.maxMoment) / (span * span);

    return {
        span: span,
        udl: equivalentUDL,
        point_load: 0,
        point_load_position: 0,
        grade: steelGrade,
        section: member.section || '305x165x54',
        section_type: member.sectionType || 'UB'
    };
}

/**
 * Prepare column design request from analysis results
 * @param {Object} member - Member object {id, type, height, section, sectionType}
 * @param {Object} forces - {maxMoment, maxShear, axialLoad}
 * @param {string} steelGrade - Steel grade
 * @returns {Object} Column design request payload
 */
export function prepareColumnDesignRequest(member, forces, steelGrade = 'S275') {
    return {
        height: member.height || member.length || 4.0,
        axial_load: forces.axialLoad || 1000, // kN
        moment_major: forces.maxMoment || 0,
        moment_minor: 0,
        grade: steelGrade,
        section: member.section || '203x203x60',
        section_type: member.sectionType || 'UC',
        effective_length_major: member.effectiveLengthMajor || 1.0,
        effective_length_minor: member.effectiveLengthMinor || 1.0
    };
}

/**
 * Design a single steel beam
 * @param {Object} designRequest - Beam design request
 * @returns {Promise<Object>} Design results
 */
export async function designSteelBeam(designRequest) {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/beam-design`,
            designRequest
        );
        return {
            success: true,
            ...response.data
        };
    } catch (error) {
        console.error('Beam design failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Design a single steel column
 * @param {Object} designRequest - Column design request
 * @returns {Promise<Object>} Design results
 */
export async function designSteelColumn(designRequest) {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/api/column-design`,
            designRequest
        );
        return {
            success: true,
            ...response.data
        };
    } catch (error) {
        console.error('Column design failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Design all members in a structure
 * @param {Object} analysisResults - Frame analysis results
 * @param {Array} members - Array of member objects
 * @param {string} steelGrade - Steel grade
 * @returns {Promise<Object>} Design results for all members
 */
export async function designAllSteelMembers(analysisResults, members, steelGrade = 'S275') {
    const designResults = {
        beams: [],
        columns: [],
        summary: {
            totalMembers: members.length,
            passedMembers: 0,
            failedMembers: 0
        }
    };

    for (const member of members) {
        // Extract forces for this member
        const forces = extractMemberForces(analysisResults, member.id);

        try {
            if (member.type === 'beam' || member.memberType === 'beam') {
                // Design as beam
                const request = prepareBeamDesignRequest(member, forces, steelGrade);
                const result = await designSteelBeam(request);

                designResults.beams.push({
                    memberId: member.id,
                    memberLabel: member.label || `Beam ${member.id}`,
                    ...result
                });

                if (result.passed) {
                    designResults.summary.passedMembers++;
                } else {
                    designResults.summary.failedMembers++;
                }
            } else if (member.type === 'column' || member.memberType === 'column') {
                // Design as column
                const request = prepareColumnDesignRequest(member, forces, steelGrade);
                const result = await designSteelColumn(request);

                designResults.columns.push({
                    memberId: member.id,
                    memberLabel: member.label || `Column ${member.id}`,
                    ...result
                });

                if (result.passed) {
                    designResults.summary.passedMembers++;
                } else {
                    designResults.summary.failedMembers++;
                }
            }
        } catch (error) {
            console.error(`Design failed for member ${member.id}:`, error);
            designResults.summary.failedMembers++;
        }
    }

    return designResults;
}

/**
 * Get available steel sections from backend
 * @param {string} sectionType - 'UB' or 'UC'
 * @returns {Promise<Array>} List of available sections
 */
export async function getAvailableSections(sectionType = 'UB') {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/api/sections/${sectionType}`
        );
        return response.data;
    } catch (error) {
        console.error('Failed to fetch sections:', error);
        return [];
    }
}

/**
 * Calculate utilization ratio for a member
 * @param {Object} designResult - Design result from API
 * @returns {number} Maximum utilization ratio (0-1+)
 */
export function calculateUtilizationRatio(designResult) {
    if (!designResult) return 0;

    if (designResult.bending_ratio !== undefined) {
        // Beam
        return Math.max(
            parseFloat(designResult.bending_ratio) / 100,
            parseFloat(designResult.shear_ratio) / 100,
            parseFloat(designResult.deflection_ratio) / 100
        );
    } else if (designResult.interaction !== undefined) {
        // Column
        return parseFloat(designResult.interaction) / 100;
    }

    return 0;
}

/**
 * Convert structure builder elements to analysis format
 * @param {Array} elements - Structure builder elements
 * @returns {Object} {nodes, members, loads}
 */
export function convertToAnalysisFormat(elements) {
    const nodes = [];
    const members = [];
    const loads = [];
    const nodeMap = new Map();

    let nodeId = 1;

    // Helper to get or create node
    const getOrAddNode = (x, y, z = 0) => {
        const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
        if (nodeMap.has(key)) {
            return nodeMap.get(key);
        }
        const id = nodeId++;
        nodeMap.set(key, id);
        nodes.push({ id, x, y, z });
        return id;
    };

    // Process elements
    elements.forEach((element, index) => {
        if (element.type === 'beam') {
            const startNode = getOrAddNode(element.x1, element.y1, element.z1 || 0);
            const endNode = getOrAddNode(element.x2, element.y2, element.z2 || 0);

            members.push({
                id: element.id || `M${index + 1}`,
                type: 'beam',
                startNode,
                endNode,
                section: element.section,
                sectionType: element.sectionType || 'UB',
                length: element.length
            });

            // Add loads if present
            if (element.udl) {
                loads.push({
                    memberId: element.id || `M${index + 1}`,
                    type: 'udl',
                    value: element.udl
                });
            }
        } else if (element.type === 'column') {
            const startNode = getOrAddNode(element.x, element.y, element.z || 0);
            const endNode = getOrAddNode(element.x, element.y, (element.z || 0) + element.height);

            members.push({
                id: element.id || `C${index + 1}`,
                type: 'column',
                startNode,
                endNode,
                section: element.section,
                sectionType: element.sectionType || 'UC',
                height: element.height
            });

            // Add axial load if present
            if (element.axialLoad) {
                loads.push({
                    memberId: element.id || `C${index + 1}`,
                    type: 'axial',
                    value: element.axialLoad
                });
            }
        }
    });

    return { nodes, members, loads };
}

export default {
    extractMemberForces,
    prepareBeamDesignRequest,
    prepareColumnDesignRequest,
    designSteelBeam,
    designSteelColumn,
    designAllSteelMembers,
    getAvailableSections,
    calculateUtilizationRatio,
    convertToAnalysisFormat
};
