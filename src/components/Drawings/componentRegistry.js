/**
 * Component Registry for Universal 3D Visualization Canvas
 * Maps component types to their Scene components, Settings components, and default settings
 */

// Import QS Scene Components
import { PoolScene } from '../takeoff2/swimming/PoolScene';
import { PoolSettings, defaultPoolSettings } from '../takeoff2/swimming/PoolSettings';
import { DrainageScene } from "../takeoff2/Manhole/DrainageScene";
import DrainageSettings, { defaultDrainageSettings } from "../takeoff2/Manhole/DrainageSettings";
import { RoofScene } from "../takeoff2/RoofWorks/RoofScene";
import RoofSettings, { defaultRoofSettings } from "../takeoff2/RoofWorks/RoofSettings";
import { ExternalWorksScene } from "../takeoff2/ExternalWorks/ExternalWorksScene";
import ExternalWorksSettings, { defaultExternalWorksSettings } from "../takeoff2/ExternalWorks/ExternalWorksSettings";
import { DoorWindowScene } from '../takeoff2/Door_Window/DoorWindowScene';
import { DoorWindowSettings, defaultDoorWindowSettings } from '../takeoff2/Door_Window/DoorWindowSettings';
import { InternalFinishesScene } from '../takeoff2/Internal_Finishes/InternalFinishesScene';
import { InternalFinishesSettings, defaultInternalFinishesSettings } from '../takeoff2/Internal_Finishes/InternalFinishesSettings';
import { SubstructureSceneImpl } from '../takeoff2/SubStrucure_works/SubstructureScene';
import { SubstructureSettings, defaultSubstructureSettings } from '../takeoff2/SubStrucure_works/SubstructureSettings';
import { ElectricalPlumbingScene } from '../takeoff2/Electrical_Plumbing/ElectricalPlumbingScene';
import { ElectricalPlumbingSettings, defaultElectricalPlumbingSettings } from '../takeoff2/Electrical_Plumbing/ElectricalPlumbingSettings';
import { StaircaseScene } from '../takeoff2/Stairs/StaircaseScene';
import { StaircaseSettings, defaultStaircaseSettings } from '../takeoff2/Stairs/StaircaseSettings';
import { SepticScene } from '../takeoff2/septik/SepticScene';
import { SepticSettings, defaultSepticSettings } from '../takeoff2/septik/SepticSettings';

// Import RC Components (existing)
import {
    DrawStairsMST1,
    DrawStairsMST2,
} from '../ReinforcedConcrete/Stairs/Stairs_Three';
import { MultiSpanBeam3D } from '../ReinforcedConcrete/Beams/Beam_THree';
import {
    DrawColumnMC1,
    DrawColumnMC2,
    DrawColumnMC3,
    DrawColumnMC4,
    DrawColumnMC5,
} from '../ReinforcedConcrete/Columns/Columns_THree';
import {
    DrawPadFootingMF1,
    DrawPileCapMF2,
    DrawMultiColumnBaseMF3,
    DrawGroundSlabBeamMF4,
} from '../ReinforcedConcrete/Foundations/Foundation_Three';
import {
    DrawWallMW1,
    DrawWallMW2,
    DrawWallMW3,
    DrawWallMW4,
} from '../ReinforcedConcrete/Walls/wall_Three';
import {
    DrawSlabMS1,
    DrawSlabMS2,
    DrawSlabMS3,
} from '../ReinforcedConcrete/Slabs/slab_THReeD';
import { DrawRetainingWallMRW1 } from '../ReinforcedConcrete/Rwall/Retaining_Three';
import { FrameScene } from '../ReinforcedConcrete/FramedandTall/FrameScene';

/**
 * Component Type Enum
 */
export const COMPONENT_TYPES = {
    RC: 'rc',
    QS: 'qs',
};

/**
 * Quantity Surveying Components Registry
 * Each entry contains:
 * - Scene: The 3D scene component (without Canvas)
 * - Settings: The settings UI component
 * - defaultSettings: Default settings object
 * - type: Component type identifier
 */
export const QS_COMPONENTS = {
    pool: {
        Scene: PoolScene,
        Settings: PoolSettings,
        defaultSettings: defaultPoolSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Swimming Pool',
        category: 'Quantity Surveying',
    },
    drainage: {
        Scene: DrainageScene,
        Settings: DrainageSettings,
        defaultSettings: defaultDrainageSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Drainage & Manholes',
        category: 'QS Takeoff - External Works',
    },
    roof: {
        Scene: RoofScene,
        Settings: RoofSettings,
        defaultSettings: defaultRoofSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Roof Structure',
        category: 'QS Takeoff - Roof Works',
    },
    doorWindow: {
        Scene: DoorWindowScene,
        Settings: DoorWindowSettings,
        defaultSettings: defaultDoorWindowSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Doors & Windows',
        category: 'QS Takeoff - Architectural',
    },
    internalFinishes: {
        Scene: InternalFinishesScene,
        Settings: InternalFinishesSettings,
        defaultSettings: defaultInternalFinishesSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Internal Finishes',
        category: 'QS Takeoff - Finishes',
    },
    substructure: {
        Scene: SubstructureSceneImpl,
        Settings: SubstructureSettings,
        defaultSettings: defaultSubstructureSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Substructure Works',
        category: 'QS Takeoff - Substructure',
    },
    electricalPlumbing: {
        Scene: ElectricalPlumbingScene,
        Settings: ElectricalPlumbingSettings,
        defaultSettings: defaultElectricalPlumbingSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Electrical & Plumbing',
        category: 'QS Takeoff - MEP',
    },
    staircase: {
        Scene: StaircaseScene,
        Settings: StaircaseSettings,
        defaultSettings: defaultStaircaseSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Staircase Works',
        category: 'QS Takeoff - Stairs',
    },
    septic: {
        Scene: SepticScene,
        Settings: SepticSettings,
        defaultSettings: defaultSepticSettings,
        type: COMPONENT_TYPES.QS,
        name: 'Septic System',
        category: 'QS Takeoff - MEP',
    },
    externalWorks: {
        Scene: ExternalWorksScene,
        Settings: ExternalWorksSettings,
        defaultSettings: defaultExternalWorksSettings,
        type: COMPONENT_TYPES.QS,
        name: 'External Works & Paving',
        category: 'QS Takeoff - External Works',
    },
    // Add more QS components here as they are refactored
};

/**
 * Reinforced Concrete Components Registry
 * These components return geometry directly and use RC-specific settings
 */
export const RC_COMPONENTS = {
    // Stairs
    stair_MST1: {
        Component: DrawStairsMST1,
        type: COMPONENT_TYPES.RC,
        name: 'Stair Type 1',
        category: 'Stairs',
    },
    stair_MST2: {
        Component: DrawStairsMST2,
        type: COMPONENT_TYPES.RC,
        name: 'Stair Type 2',
        category: 'Stairs',
    },

    // Beams
    beam_MB1: {
        Component: MultiSpanBeam3D,
        type: COMPONENT_TYPES.RC,
        name: 'Multi-Span Beam',
        category: 'Beams',
    },
    beam_MB2: {
        Component: MultiSpanBeam3D,
        type: COMPONENT_TYPES.RC,
        name: 'Beam Type 2',
        category: 'Beams',
    },
    beam_MB3: {
        Component: MultiSpanBeam3D,
        type: COMPONENT_TYPES.RC,
        name: 'Beam Type 3',
        category: 'Beams',
    },

    // Columns
    column_MC1: {
        Component: DrawColumnMC1,
        type: COMPONENT_TYPES.RC,
        name: 'Column Type 1',
        category: 'Columns',
    },
    column_MC2: {
        Component: DrawColumnMC2,
        type: COMPONENT_TYPES.RC,
        name: 'Column Type 2',
        category: 'Columns',
    },
    column_MC3: {
        Component: DrawColumnMC3,
        type: COMPONENT_TYPES.RC,
        name: 'Column Type 3',
        category: 'Columns',
    },
    column_MC4: {
        Component: DrawColumnMC4,
        type: COMPONENT_TYPES.RC,
        name: 'Column Type 4',
        category: 'Columns',
    },
    column_MC5: {
        Component: DrawColumnMC5,
        type: COMPONENT_TYPES.RC,
        name: 'Column Type 5',
        category: 'Columns',
    },

    // Foundations
    foundation_MF1: {
        Component: DrawPadFootingMF1,
        type: COMPONENT_TYPES.RC,
        name: 'Pad Footing',
        category: 'Foundations',
    },
    foundation_MF2: {
        Component: DrawPileCapMF2,
        type: COMPONENT_TYPES.RC,
        name: 'Pile Cap',
        category: 'Foundations',
    },
    foundation_MF3: {
        Component: DrawMultiColumnBaseMF3,
        type: COMPONENT_TYPES.RC,
        name: 'Multi-Column Base',
        category: 'Foundations',
    },
    foundation_MF4: {
        Component: DrawGroundSlabBeamMF4,
        type: COMPONENT_TYPES.RC,
        name: 'Ground Slab Beam',
        category: 'Foundations',
    },

    // Walls
    wall_MW1: {
        Component: DrawWallMW1,
        type: COMPONENT_TYPES.RC,
        name: 'Wall Type 1',
        category: 'Walls',
    },
    wall_MW2: {
        Component: DrawWallMW2,
        type: COMPONENT_TYPES.RC,
        name: 'Wall Type 2',
        category: 'Walls',
    },
    wall_MW3: {
        Component: DrawWallMW3,
        type: COMPONENT_TYPES.RC,
        name: 'Wall Type 3',
        category: 'Walls',
    },
    wall_MW4: {
        Component: DrawWallMW4,
        type: COMPONENT_TYPES.RC,
        name: 'Wall Type 4',
        category: 'Walls',
    },

    // Slabs
    slab_MS1: {
        Component: DrawSlabMS1,
        type: COMPONENT_TYPES.RC,
        name: 'Slab Type 1',
        category: 'Slabs',
    },
    slab_MS2: {
        Component: DrawSlabMS2,
        type: COMPONENT_TYPES.RC,
        name: 'Slab Type 2',
        category: 'Slabs',
    },
    slab_MS3: {
        Component: DrawSlabMS3,
        type: COMPONENT_TYPES.RC,
        name: 'Slab Type 3',
        category: 'Slabs',
    },

    // Retaining Walls
    retaining_MRW1: {
        Component: DrawRetainingWallMRW1,
        type: COMPONENT_TYPES.RC,
        name: 'Retaining Wall',
        category: 'Retaining Walls',
    },
    tall_framed_analysis: {
        Component: FrameScene,
        type: COMPONENT_TYPES.RC,
        name: 'Tall Frame Analysis',
        category: 'Analysis',
    },
};

/**
 * Combined Component Registry
 */
export const COMPONENT_REGISTRY = {
    ...QS_COMPONENTS,
    ...RC_COMPONENTS,
};

/**
 * Helper function to get component configuration
 */
export function getComponentConfig(componentType) {
    return COMPONENT_REGISTRY[componentType] || null;
}

/**
 * Helper function to check if component is QS type
 */
export function isQSComponent(componentType) {
    const config = getComponentConfig(componentType);
    return config?.type === COMPONENT_TYPES.QS;
}

/**
 * Helper function to check if component is RC type
 */
export function isRCComponent(componentType) {
    const config = getComponentConfig(componentType);
    return config?.type === COMPONENT_TYPES.RC;
}

/**
 * Get all components by category
 */
export function getComponentsByCategory(category) {
    return Object.entries(COMPONENT_REGISTRY)
        .filter(([_, config]) => config.category === category)
        .reduce((acc, [key, config]) => ({ ...acc, [key]: config }), {});
}

/**
 * Get all QS components
 */
export function getAllQSComponents() {
    return QS_COMPONENTS;
}

/**
 * Get all RC components
 */
export function getAllRCComponents() {
    return RC_COMPONENTS;
}

export default COMPONENT_REGISTRY;
