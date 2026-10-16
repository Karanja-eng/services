// frontend/hooks/useSurveyingAPI.js
/**
 * Custom React hooks for surveying API calls
 * 
 * Usage:
 * const { data, loading, error, calculate } = useHorizontalCurve();
 * await calculate({ radius: 150, intersectionAngle: 45, chainageIP: 1000 });
 */

import { useState, useCallback } from 'react';

// API Base URL - configure based on environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ==================== GENERIC API HOOK ====================

function useAPI(endpoint) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const execute = useCallback(async (params) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, [endpoint]);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
    }, []);

    return { data, loading, error, execute, reset };
}

// ==================== SPECIFIC HOOKS ====================

/**
 * Hook for horizontal curve calculations
 */
export function useHorizontalCurve() {
    return useAPI('/surveying_alignment/alignment/horizontal-curve');
}

/**
 * Hook for vertical curve calculations
 */
export function useVerticalCurve() {
    return useAPI('/surveying_alignment/alignment/vertical-curve');
}

/**
 * Hook for chainage RL calculations
 */
export function useChainageRL() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const calculate = useCallback(async (chainage, verticalCurve) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/surveying_alignment/alignment/chainage-rl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chainage,
                    vertical_curve: {
                        grade_in: verticalCurve.gradeIn,
                        grade_out: verticalCurve.gradeOut,
                        curve_length: verticalCurve.curveLength,
                        chainage_vip: verticalCurve.chainageVIP,
                        rl_vip: verticalCurve.rlVIP,
                    },
                }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, calculate };
}

/**
 * Hook for offset calculations
 */
export function useOffset() {
    return useAPI('/surveying_alignment/setting-out/offset');
}

/**
 * Hook for deflection table generation
 */
export function useDeflectionTable() {
    return useAPI('/surveying_alignment/alignment/deflection-table');
}

/**
 * Hook for grid generation
 */
export function useGrid() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const generate = useCallback(async (params) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/surveying_alignment/setting-out/grid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: params.origin,
                    grid_spacing_x: params.gridSpacingX,
                    grid_spacing_y: params.gridSpacingY,
                    extent_x: params.extentX,
                    extent_y: params.extentY,
                    rotation: params.rotation || 0,
                }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, generate };
}

/**
 * Hook for superelevation calculations
 */
export function useSuperelevation() {
    return useAPI('/surveying_alignment/alignment/superelevation');
}

/**
 * Hook for curve widening calculations
 */
export function useWidening() {
    return useAPI('/surveying_alignment/alignment/widening');
}

/**
 * Hook for coordinate transformation
 */
export function useCoordinateTransform() {
    return useAPI('/surveying_alignment/transform/coordinates');
}

/**
 * Hook for profile board calculations
 */
export function useProfileBoard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const calculate = useCallback(async (params) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/surveying_alignment/setting-out/profile-board`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    design_rl: params.designRL,
                    existing_rl: params.existingRL,
                    board_height: params.boardHeight || 1.0,
                    offset_distance: params.offsetDistance || 2.0,
                }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, calculate };
}

/**
 * Hook for minimum radius calculations
 */
export function useMinimumRadius() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const calculate = useCallback(async (
        designSpeed,
        superelevationRate,
        frictionFactor
    ) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                design_speed: designSpeed.toString(),
                superelevation_rate: (superelevationRate || 0.06).toString(),
                friction_factor: (frictionFactor || 0.15).toString(),
            });

            const response = await fetch(
                `${API_BASE_URL}/surveying_alignment/alignment/minimum-radius?${params}`
            );

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Unknown error'));
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, calculate };
}

// ==================== BATCH OPERATIONS ====================

/**
 * Hook for batch chainage RL calculations
 * Useful for generating vertical profiles
 */
export function useBatchChainageRL() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const calculateBatch = useCallback(
        async (chainages, verticalCurve) => {
            setLoading(true);
            setError(null);

            try {
                const promises = chainages.map((ch) =>
                    fetch(`${API_BASE_URL}/surveying_alignment/alignment/chainage-rl`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chainage: ch,
                            vertical_curve: {
                                grade_in: verticalCurve.gradeIn,
                                grade_out: verticalCurve.gradeOut,
                                curve_length: verticalCurve.curveLength,
                                chainage_vip: verticalCurve.chainageVIP,
                                rl_vip: verticalCurve.rlVIP,
                            },
                        }),
                    }).then((res) => res.json())
                );

                const results = await Promise.all(promises);
                setData(results);
            } catch (e) {
                setError(e instanceof Error ? e : new Error('Unknown error'));
            } finally {
                setLoading(false);
            }
        },
        []
    );

    return { data, loading, error, calculateBatch };
}

// ==================== EXPORT ALL ====================

export default {
    useHorizontalCurve,
    useVerticalCurve,
    useChainageRL,
    useOffset,
    useDeflectionTable,
    useGrid,
    useSuperelevation,
    useWidening,
    useCoordinateTransform,
    useProfileBoard,
    useMinimumRadius,
    useBatchChainageRL,
};
