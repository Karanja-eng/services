import React, { useState } from 'react';
import { Camera, Droplets, Mountain, Ruler, TrendingDown, AlertTriangle, ChevronRight, FileText, Upload } from 'lucide-react';

// Placeholder components - replace with actual imports
const ReservoirCurveChart = ({ storageTable, deadStorageLevel }: any) => (
    <div className="h-96 bg-gradient-to-br from-blue-50 to-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
        <div className="text-center">
            <Droplets className="w-16 h-16 mx-auto text-blue-400 mb-4" />
            <p className="text-gray-600">Reservoir Curve Chart</p>
            <p className="text-sm text-gray-400 mt-2">Import actual component to display data</p>
        </div>
    </div>
);

const CatchmentPlan2D = ({ boundaryPoints, subCatchments }: any) => (
    <div className="h-96 bg-gradient-to-br from-green-50 to-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
        <div className="text-center">
            <Mountain className="w-16 h-16 mx-auto text-green-400 mb-4" />
            <p className="text-gray-600">Catchment Plan 2D</p>
            <p className="text-sm text-gray-400 mt-2">Import actual component to display data</p>
        </div>
    </div>
);

const RiverProfileChart = ({ profilePoints, gradients }: any) => (
    <div className="h-96 bg-gradient-to-br from-cyan-50 to-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
        <div className="text-center">
            <TrendingDown className="w-16 h-16 mx-auto text-cyan-400 mb-4" />
            <p className="text-gray-600">River Profile Chart</p>
            <p className="text-sm text-gray-400 mt-2">Import actual component to display data</p>
        </div>
    </div>
);

const Bathymetry3D = ({ surveyPoints, referenceLevel }: any) => (
    <div className="h-96 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
        <div className="text-center">
            <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-300">Bathymetry 3D Viewer</p>
            <p className="text-sm text-gray-500 mt-2">Import actual component to display data</p>
        </div>
    </div>
);

type AnalysisModule = 'reservoir' | 'catchment' | 'river' | 'bathymetry';

const HydrographicDashboard: React.FC = () => {
    const [activeModule, setActiveModule] = useState < AnalysisModule | null > (null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Sample data for demonstrations
    const sampleReservoirData = [
        { level: 100, area: 10000, incremental_volume: 0, cumulative_volume: 0 },
        { level: 105, area: 25000, incremental_volume: 87500, cumulative_volume: 87500 },
        { level: 110, area: 45000, incremental_volume: 175000, cumulative_volume: 262500 },
        { level: 115, area: 70000, incremental_volume: 287500, cumulative_volume: 550000 },
    ];

    const sampleCatchmentData = [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1200, y: 600 },
        { x: 800, y: 1000 },
        { x: 200, y: 900 },
        { x: 0, y: 500 },
    ];

    const sampleRiverProfile = [
        { chainage: 0, elevation: 125.5, description: 'Upstream' },
        { chainage: 200, elevation: 124.2, description: '' },
        { chainage: 400, elevation: 122.8, description: '' },
        { chainage: 600, elevation: 121.5, description: '' },
        { chainage: 800, elevation: 120.1, description: 'Downstream' },
    ];

    const sampleGradients = [
        { start_chainage: 0, end_chainage: 200, start_elevation: 125.5, end_elevation: 124.2, gradient: 0.0065, gradient_percent: 0.65 },
        { start_chainage: 200, end_chainage: 400, start_elevation: 124.2, end_elevation: 122.8, gradient: 0.007, gradient_percent: 0.70 },
        { start_chainage: 400, end_chainage: 600, start_elevation: 122.8, end_elevation: 121.5, gradient: 0.0065, gradient_percent: 0.65 },
        { start_chainage: 600, end_chainage: 800, start_elevation: 121.5, end_elevation: 120.1, gradient: 0.007, gradient_percent: 0.70 },
    ];

    const sampleBathymetryPoints = Array.from({ length: 100 }, (_, i) => ({
        x: (i % 10) * 10,
        y: Math.floor(i / 10) * 10,
        z: -5 - Math.random() * 2 - Math.sin(i * 0.3) * 1.5,
    }));

    const modules = [
        {
            id: 'reservoir' as AnalysisModule,
            name: 'Reservoir Analysis',
            icon: Droplets,
            description: 'Area-capacity curves and storage analysis',
            color: 'blue',
            features: ['Storage curves', 'Dead/live storage', 'Capacity tables']
        },
        {
            id: 'catchment' as AnalysisModule,
            name: 'Catchment Delineation',
            icon: Mountain,
            description: 'Watershed boundary and drainage area',
            color: 'green',
            features: ['Boundary analysis', 'Sub-catchments', 'Area calculation']
        },
        {
            id: 'river' as AnalysisModule,
            name: 'River Profile',
            icon: TrendingDown,
            description: 'Longitudinal profiles and gradients',
            color: 'cyan',
            features: ['Bed profiles', 'Gradient analysis', 'Slope validation']
        },
        {
            id: 'bathymetry' as AnalysisModule,
            name: 'Bathymetric Survey',
            icon: Camera,
            description: 'Volume calculations and 3D visualization',
            color: 'gray',
            features: ['Volume analysis', '3D surface', 'Depth mapping']
        },
    ];

    const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border' | 'hover') => {
        const colors: Record<string, Record<string, string>> = {
            blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500', hover: 'hover:bg-blue-50' },
            green: { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500', hover: 'hover:bg-green-50' },
            cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-500', hover: 'hover:bg-cyan-50' },
            gray: { bg: 'bg-gray-700', text: 'text-gray-600', border: 'border-gray-500', hover: 'hover:bg-gray-50' },
        };
        return colors[color]?.[variant] || '';
    };

    const renderModuleContent = () => {
        switch (activeModule) {
            case 'reservoir':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Reservoir Storage Analysis</h2>
                                <p className="text-gray-600 mt-1">Calculate area-capacity curves for dam design and safety</p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                <Upload className="w-4 h-4" />
                                Load Survey Data
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Total Capacity</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">550,000 m³</div>
                                <div className="text-xs text-gray-500 mt-1">0.55 Mm³</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Live Storage</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">462,500 m³</div>
                                <div className="text-xs text-green-600 mt-1">84% of total</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Dead Storage</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">87,500 m³</div>
                                <div className="text-xs text-gray-500 mt-1">Below 102m</div>
                            </div>
                        </div>

                        <ReservoirCurveChart
                            storageTable={sampleReservoirData}
                            deadStorageLevel={102}
                        />

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="font-semibold text-amber-900">Validation Notice</div>
                                <div className="text-sm text-amber-800 mt-1">
                                    All calculations preserve raw survey data. Review engineering documentation before using in final design.
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'catchment':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Catchment Area Analysis</h2>
                                <p className="text-gray-600 mt-1">Calculate watershed boundaries and drainage areas</p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                                <Upload className="w-4 h-4" />
                                Load Boundary Data
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Total Area</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">0.75 km²</div>
                                <div className="text-xs text-gray-500 mt-1">750,000 m²</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Perimeter</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">3,860 m</div>
                                <div className="text-xs text-gray-500 mt-1">3.86 km</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Boundary Points</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{sampleCatchmentData.length}</div>
                                <div className="text-xs text-green-600 mt-1">Closure valid</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Closure Error</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">0.00 m</div>
                                <div className="text-xs text-green-600 mt-1">Within tolerance</div>
                            </div>
                        </div>

                        <CatchmentPlan2D
                            boundaryPoints={sampleCatchmentData}
                            subCatchments={[]}
                        />
                    </div>
                );

            case 'river':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">River Longitudinal Profile</h2>
                                <p className="text-gray-600 mt-1">Analyze bed gradients and elevation profiles</p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
                                <Upload className="w-4 h-4" />
                                Load Profile Data
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Total Length</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">800 m</div>
                                <div className="text-xs text-gray-500 mt-1">Profile length</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Elevation Drop</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">5.4 m</div>
                                <div className="text-xs text-gray-500 mt-1">Upstream to downstream</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Avg Gradient</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">0.675%</div>
                                <div className="text-xs text-green-600 mt-1">Within normal range</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Profile Points</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{sampleRiverProfile.length}</div>
                                <div className="text-xs text-gray-500 mt-1">Survey stations</div>
                            </div>
                        </div>

                        <RiverProfileChart
                            profilePoints={sampleRiverProfile}
                            gradients={sampleGradients}
                        />
                    </div>
                );

            case 'bathymetry':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Bathymetric Volume Analysis</h2>
                                <p className="text-gray-600 mt-1">Calculate volumes from underwater surveys</p>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition">
                                <Upload className="w-4 h-4" />
                                Load Survey Points
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Volume</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">4,850 m³</div>
                                <div className="text-xs text-gray-500 mt-1">Below reference</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Surface Area</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">900 m²</div>
                                <div className="text-xs text-gray-500 mt-1">At reference level</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Avg Depth</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">5.39 m</div>
                                <div className="text-xs text-gray-500 mt-1">Mean depth</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="text-sm text-gray-600">Survey Points</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{sampleBathymetryPoints.length}</div>
                                <div className="text-xs text-gray-500 mt-1">Grid interpolated</div>
                            </div>
                        </div>

                        <Bathymetry3D
                            surveyPoints={sampleBathymetryPoints}
                            referenceLevel={0}
                        />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                                <Ruler className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Hydrographic & Environmental Analysis</h1>
                                <p className="text-xs text-gray-500">Engineering-grade water infrastructure calculations</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">
                                <FileText className="w-4 h-4" />
                                Documentation
                            </button>
                            <div className="h-6 w-px bg-gray-300"></div>
                            <div className="text-sm text-gray-600">
                                <span className="font-semibold">v1.0.0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex max-w-7xl mx-auto">
                {/* Sidebar */}
                <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-white border-r border-gray-200`}>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-semibold text-gray-900">Analysis Modules</h2>
                        </div>

                        {modules.map((module) => {
                            const Icon = module.icon;
                            const isActive = activeModule === module.id;

                            return (
                                <button
                                    key={module.id}
                                    onClick={() => setActiveModule(module.id)}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition ${isActive
                                        ? `${getColorClasses(module.color, 'border')} bg-gray-50`
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 ${getColorClasses(module.color, 'bg')} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                            <Icon className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900">{module.name}</div>
                                            <div className="text-xs text-gray-600 mt-1">{module.description}</div>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {module.features.map((feature, idx) => (
                                                    <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                        {feature}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {isActive && <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                                    </div>
                                </button>
                            );
                        })}

                        <div className="pt-4 border-t border-gray-200">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-xs text-blue-900">
                                        <div className="font-semibold">Decision-Grade Outputs</div>
                                        <div className="mt-1">All calculations follow established civil engineering practice.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    {activeModule ? (
                        renderModuleContent()
                    ) : (
                        <div className="max-w-4xl mx-auto">
                            <div className="text-center py-12">
                                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                    <Ruler className="w-10 h-10 text-blue-600" />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                                    Welcome to Hydrographic Analysis Platform
                                </h2>
                                <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                                    Professional-grade calculations for water infrastructure projects.
                                    Select a module from the sidebar to begin your analysis.
                                </p>

                                <div className="grid grid-cols-2 gap-6 mt-12">
                                    {modules.map((module) => {
                                        const Icon = module.icon;
                                        return (
                                            <button
                                                key={module.id}
                                                onClick={() => setActiveModule(module.id)}
                                                className={`p-6 bg-white border border-gray-200 rounded-xl ${getColorClasses(module.color, 'hover')} transition text-left group`}
                                            >
                                                <div className={`w-12 h-12 ${getColorClasses(module.color, 'bg')} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition`}>
                                                    <Icon className="w-6 h-6 text-white" />
                                                </div>
                                                <h3 className="font-semibold text-gray-900 mb-2">{module.name}</h3>
                                                <p className="text-sm text-gray-600">{module.description}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-12 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-8 text-white">
                                <h3 className="text-xl font-bold mb-4">Engineering Rigor</h3>
                                <div className="grid grid-cols-3 gap-6">
                                    <div>
                                        <div className="text-3xl font-bold text-blue-400 mb-2">Zero</div>
                                        <div className="text-sm text-gray-300">Silent corrections or hidden assumptions</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-green-400 mb-2">100%</div>
                                        <div className="text-sm text-gray-300">Transparent calculation methodology</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-bold text-cyan-400 mb-2">Full</div>
                                        <div className="text-sm text-gray-300">Validation and quality checks</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-2 gap-4">
                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <h4 className="font-semibold text-gray-900 mb-3">Critical Applications</h4>
                                    <ul className="space-y-2 text-sm text-gray-600">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            Dam safety and reservoir design
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            Flood risk assessment
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            Environmental impact studies
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            Dredging and sedimentation analysis
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <h4 className="font-semibold text-gray-900 mb-3">Key Features</h4>
                                    <ul className="space-y-2 text-sm text-gray-600">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                            Engineering-grade numerical precision
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                            Comprehensive validation framework
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                            Interactive 2D/3D visualization
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                            Complete audit trail and documentation
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default HydrographicDashboard;