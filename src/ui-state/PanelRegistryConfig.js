import { panelRegistry } from './PanelRegistry';

// Architecture Panels
import WallsPanel from '../components/arch_pro/Architectural_Compnents.jsx/WallsPanel';
import DoorPanel from '../components/arch_pro/Architectural_Compnents.jsx/DoorPanel';
import WindowsPanel from '../components/arch_pro/Architectural_Compnents.jsx/WindowsPanel';
import FloorsPanel from '../components/arch_pro/Architectural_Compnents.jsx/FloorsPanel';
import RoofEditor from '../components/arch_pro/RoofEditor';

// Plumbing Panels
import PlumbingFixturesPanel from '../components/arch_pro/Plumbing_systems/PlumbingFixturesPanel';
import WaterSupplyPanel from '../components/arch_pro/Plumbing_systems/WaterSupplyPanel';
import DrainageandVentPanel from '../components/arch_pro/Plumbing_systems/DrainageandVentPanel';
import PlumbingSystemInpector from '../components/arch_pro/Plumbing_systems/PlumbingSystemInpector';

// Electrical Panels
import ElectricalFixturesPanel from '../components/arch_pro/ElectricalSystem/ElectricalFixturesPanel';
import SwitchingandZoningPanel from '../components/arch_pro/ElectricalSystem/SwitchingandZoningPanel';
import CircuitsandPanelsPanel from '../components/arch_pro/ElectricalSystem/CircuitsandPanelsPanel';
import ElectricalSystemInspector from '../components/arch_pro/ElectricalSystem/ElectricalSystemInspector';

// Structural Panels
import FoundationPanel from '../components/arch_pro/Architectural_Compnents.jsx/FoundationPanel';

export const registerAllPanels = () => {
    // Architecture
    panelRegistry.register('arch_walls', { component: WallsPanel, label: 'Walls' });
    panelRegistry.register('arch_doors', { component: DoorPanel, label: 'Doors' });
    panelRegistry.register('arch_windows', { component: WindowsPanel, label: 'Windows' });
    panelRegistry.register('arch_floors', { component: FloorsPanel, label: 'Floors' });
    panelRegistry.register('arch_roofs', { component: RoofEditor, label: 'Roofs' });

    // Plumbing
    panelRegistry.register('plumb_fixtures', { component: PlumbingFixturesPanel, label: 'Fixtures' });
    panelRegistry.register('plumb_water', { component: WaterSupplyPanel, label: 'Water Supply' });
    panelRegistry.register('plumb_drainage', { component: DrainageandVentPanel, label: 'Drainage' });
    panelRegistry.register('plumb_inspector', {
        component: PlumbingSystemInpector,
        label: 'Plumbing Inspector',
        isInspector: true
    });

    // Electrical
    panelRegistry.register('elec_fixtures', { component: ElectricalFixturesPanel, label: 'Fixtures' });
    panelRegistry.register('elec_switching', { component: SwitchingandZoningPanel, label: 'Switching' });
    panelRegistry.register('elec_circuits', { component: CircuitsandPanelsPanel, label: 'Circuits' });
    panelRegistry.register('elec_inspector', {
        component: ElectricalSystemInspector,
        label: 'Electrical Inspector',
        isInspector: true
    });

    // Structural
    panelRegistry.register('struct_foundations', { component: FoundationPanel, label: 'Foundations' });
};
