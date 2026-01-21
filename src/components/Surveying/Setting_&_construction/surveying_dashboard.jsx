import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// UI Components replacement for Shadcn
const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
        {children}
    </div>
);

const CardHeader = ({ children }) => (
    <div className="p-6 pb-2">
        {children}
    </div>
);

const CardTitle = ({ children, className = "" }) => (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
        {children}
    </h3>
);

const CardDescription = ({ children, className = "" }) => (
    <p className={`text-sm text-gray-500 ${className}`}>
        {children}
    </p>
);

const CardContent = ({ children, className = "" }) => (
    <div className={`p-6 pt-2 ${className}`}>
        {children}
    </div>
);

const Label = ({ children, className = "" }) => (
    <label className={`block text-sm font-medium text-gray-700 mb-1.5 ${className}`}>
        {children}
    </label>
);

const Input = ({ className = "", ...props }) => (
    <input
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
    />
);

const Button = ({ children, className = "", variant = "primary", ...props }) => {
    const variants = {
        primary: "bg-gray-900 text-white hover:bg-gray-800",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        outline: "border border-gray-300 bg-white hover:bg-gray-50"
    };

    return (
        <button
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

const TabButton = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`flex-1 px-3 py-2 text-sm font-medium transition-all rounded-md ${active
            ? 'bg-white text-gray-950 shadow-sm'
            : 'text-gray-500 hover:text-gray-950'
            }`}
    >
        {children}
    </button>
);

// Horizontal Curve Calculator Component
const HorizontalCurveCalculator = () => {
    const [inputs, setInputs] = useState({
        radius: 200,
        intersectionAngle: 45,
        chainageIP: 1000
    });
    const [result, setResult] = useState(null);

    const calculate = () => {
        const deltaRad = Math.abs(inputs.intersectionAngle) * (Math.PI / 180);
        const halfDelta = deltaRad / 2;

        const tangentLength = inputs.radius * Math.tan(halfDelta);
        const curveLength = inputs.radius * deltaRad;
        const externalDistance = inputs.radius * (1 / Math.cos(halfDelta) - 1);
        const middleOrdinate = inputs.radius * (1 - Math.cos(halfDelta));
        const longChord = 2 * inputs.radius * Math.sin(halfDelta);
        const chainageTC = inputs.chainageIP - tangentLength;
        const chainageCT = chainageTC + curveLength;

        setResult({
            tangentLength: tangentLength.toFixed(3),
            curveLength: curveLength.toFixed(3),
            externalDistance: externalDistance.toFixed(3),
            middleOrdinate: middleOrdinate.toFixed(3),
            longChord: longChord.toFixed(3),
            chainageTC: chainageTC.toFixed(3),
            chainageCT: chainageCT.toFixed(3)
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label>Radius (m)</Label>
                    <Input
                        type="number"
                        value={inputs.radius}
                        onChange={(e) => setInputs({ ...inputs, radius: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Intersection Angle (°)</Label>
                    <Input
                        type="number"
                        value={inputs.intersectionAngle}
                        onChange={(e) => setInputs({ ...inputs, intersectionAngle: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Chainage at IP (m)</Label>
                    <Input
                        type="number"
                        value={inputs.chainageIP}
                        onChange={(e) => setInputs({ ...inputs, chainageIP: parseFloat(e.target.value) })}
                    />
                </div>
            </div>

            <Button onClick={calculate} className="w-full">Calculate Curve</Button>

            {result && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm border-b sm:border-b-0 pb-2 sm:pb-0">
                        <span className="text-gray-600 block sm:inline">Tangent Length (T):</span>
                        <span className="sm:float-right font-mono font-semibold">{result.tangentLength} m</span>
                    </div>
                    <div className="text-sm border-b sm:border-b-0 pb-2 sm:pb-0">
                        <span className="text-gray-600 block sm:inline">Curve Length (L):</span>
                        <span className="sm:float-right font-mono font-semibold">{result.curveLength} m</span>
                    </div>
                    <div className="text-sm border-b sm:border-b-0 pb-2 sm:pb-0">
                        <span className="text-gray-600 block sm:inline">External Distance (E):</span>
                        <span className="sm:float-right font-mono font-semibold">{result.externalDistance} m</span>
                    </div>
                    <div className="text-sm border-b sm:border-b-0 pb-2 sm:pb-0">
                        <span className="text-gray-600 block sm:inline">Middle Ordinate (M):</span>
                        <span className="sm:float-right font-mono font-semibold">{result.middleOrdinate} m</span>
                    </div>
                    <div className="text-sm border-b sm:border-b-0 pb-2 sm:pb-0">
                        <span className="text-gray-600 block sm:inline">Long Chord (C):</span>
                        <span className="sm:float-right font-mono font-semibold">{result.longChord} m</span>
                    </div>
                    <div className="text-sm border-b sm:border-b-0 pb-2 sm:pb-0">
                        <span className="text-gray-600 block sm:inline">Chainage TC:</span>
                        <span className="sm:float-right font-mono font-semibold">{result.chainageTC} m</span>
                    </div>
                    <div className="text-sm sm:col-span-2">
                        <span className="text-gray-600 block sm:inline">Chainage CT:</span>
                        <span className="sm:float-right font-mono font-semibold">{result.chainageCT} m</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Vertical Curve Calculator Component
const VerticalCurveCalculator = () => {
    const [inputs, setInputs] = useState({
        gradeIn: 3.5,
        gradeOut: -2.5,
        curveLength: 100,
        chainageVIP: 500,
        rlVIP: 125.5
    });
    const [result, setResult] = useState(null);
    const [profileData, setProfileData] = useState([]);

    const calculate = () => {
        const gradeChange = inputs.gradeIn - inputs.gradeOut;
        const curveType = inputs.gradeIn > inputs.gradeOut ? 'CREST' : 'SAG';
        const rateOfChange = Math.abs(inputs.curveLength / gradeChange);

        const chainageStart = inputs.chainageVIP - inputs.curveLength / 2;
        const chainageEnd = inputs.chainageVIP + inputs.curveLength / 2;

        const gradeInDecimal = inputs.gradeIn / 100;
        const rlStart = inputs.rlVIP - (inputs.curveLength / 2) * gradeInDecimal;

        const gradeOutDecimal = inputs.gradeOut / 100;
        const rlEnd = inputs.rlVIP + (inputs.curveLength / 2) * gradeOutDecimal;

        setResult({
            curveType,
            rateOfChange: rateOfChange.toFixed(3),
            chainageStart: chainageStart.toFixed(3),
            chainageEnd: chainageEnd.toFixed(3),
            rlStart: rlStart.toFixed(3),
            rlEnd: rlEnd.toFixed(3)
        });

        const profile = [];
        const interval = 10;
        for (let ch = chainageStart; ch <= chainageEnd; ch += interval) {
            const x = ch - chainageStart;
            const ADecimal = (inputs.gradeIn - inputs.gradeOut) / 100;
            const L = inputs.curveLength;
            const rl = rlStart + gradeInDecimal * x + (ADecimal / (2 * L)) * x * x;

            profile.push({
                chainage: ch.toFixed(1),
                rl: rl.toFixed(3)
            });
        }
        setProfileData(profile);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label>Grade In (%)</Label>
                    <Input
                        type="number"
                        step="0.1"
                        value={inputs.gradeIn}
                        onChange={(e) => setInputs({ ...inputs, gradeIn: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Grade Out (%)</Label>
                    <Input
                        type="number"
                        step="0.1"
                        value={inputs.gradeOut}
                        onChange={(e) => setInputs({ ...inputs, gradeOut: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Curve Length (m)</Label>
                    <Input
                        type="number"
                        value={inputs.curveLength}
                        onChange={(e) => setInputs({ ...inputs, curveLength: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Chainage at VIP (m)</Label>
                    <Input
                        type="number"
                        value={inputs.chainageVIP}
                        onChange={(e) => setInputs({ ...inputs, chainageVIP: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>RL at VIP (m)</Label>
                    <Input
                        type="number"
                        step="0.1"
                        value={inputs.rlVIP}
                        onChange={(e) => setInputs({ ...inputs, rlVIP: parseFloat(e.target.value) })}
                    />
                </div>
            </div>

            <Button onClick={calculate} className="w-full">Calculate Curve</Button>

            {result && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="text-sm">
                            <span className="text-gray-600">Curve Type:</span>
                            <span className="float-right font-mono font-semibold">{result.curveType}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-600">K Value:</span>
                            <span className="float-right font-mono font-semibold">{result.rateOfChange}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-600">Chainage Start:</span>
                            <span className="float-right font-mono font-semibold">{result.chainageStart} m</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-600">Chainage End:</span>
                            <span className="float-right font-mono font-semibold">{result.chainageEnd} m</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-600">RL Start:</span>
                            <span className="float-right font-mono font-semibold">{result.rlStart} m</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-600">RL End:</span>
                            <span className="float-right font-mono font-semibold">{result.rlEnd} m</span>
                        </div>
                    </div>

                    <div className="h-64 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={profileData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="chainage"
                                    label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                    dataKey="rl"
                                    label={{ value: 'RL (m)', angle: -90, position: 'insideLeft' }}
                                    tick={{ fontSize: 11 }}
                                />
                                <Tooltip />
                                <Line type="monotone" dataKey="rl" stroke="#374151" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    );
};

// Deflection Angle Table Component
const DeflectionTableCalculator = () => {
    const [inputs, setInputs] = useState({
        radius: 150,
        curveLength: 75,
        pegInterval: 20,
        chainageTC: 100
    });
    const [table, setTable] = useState([]);

    const calculate = () => {
        const deflections = [];
        let distance = 0;

        while (distance <= inputs.curveLength) {
            const chainage = inputs.chainageTC + distance;
            const deflectionRad = distance / (2 * inputs.radius);
            const deflectionDeg = deflectionRad * (180 / Math.PI);
            const chord = distance > 0 ? 2 * inputs.radius * Math.sin(deflectionRad) : 0;

            deflections.push({
                chainage: chainage.toFixed(2),
                distance: distance.toFixed(2),
                deflection: deflectionDeg.toFixed(4),
                chord: chord.toFixed(3)
            });

            distance += inputs.pegInterval;
        }

        if (Math.abs(distance - inputs.pegInterval - inputs.curveLength) > 0.01) {
            const distance = inputs.curveLength;
            const chainage = inputs.chainageTC + distance;
            const deflectionRad = distance / (2 * inputs.radius);
            const deflectionDeg = deflectionRad * (180 / Math.PI);
            const chord = 2 * inputs.radius * Math.sin(deflectionRad);

            deflections.push({
                chainage: chainage.toFixed(2),
                distance: distance.toFixed(2),
                deflection: deflectionDeg.toFixed(4),
                chord: chord.toFixed(3)
            });
        }

        setTable(deflections);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <Label>Radius (m)</Label>
                    <Input
                        type="number"
                        value={inputs.radius}
                        onChange={(e) => setInputs({ ...inputs, radius: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Curve Length (m)</Label>
                    <Input
                        type="number"
                        value={inputs.curveLength}
                        onChange={(e) => setInputs({ ...inputs, curveLength: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Peg Interval (m)</Label>
                    <Input
                        type="number"
                        value={inputs.pegInterval}
                        onChange={(e) => setInputs({ ...inputs, pegInterval: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Chainage TC (m)</Label>
                    <Input
                        type="number"
                        value={inputs.chainageTC}
                        onChange={(e) => setInputs({ ...inputs, chainageTC: parseFloat(e.target.value) })}
                    />
                </div>
            </div>

            <Button onClick={calculate} className="w-full">Generate Table</Button>

            {table.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="border-b border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">Chainage (m)</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-right font-semibold text-gray-900">Dist.from TC (m)</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-right font-semibold text-gray-900">Deflection (°)</th>
                                <th className="border-b border-gray-200 px-4 py-3 text-right font-semibold text-gray-900">Chord (m)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {table.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-200/50 transition-colors">
                                    <td className="px-4 py-2 font-mono">{row.chainage}</td>
                                    <td className="px-4 py-2 text-right font-mono">{row.distance}</td>
                                    <td className="px-4 py-2 text-right font-mono text-blue-600">{row.deflection}</td>
                                    <td className="px-4 py-2 text-right font-mono">{row.chord}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Offset Calculator Component
const OffsetCalculator = () => {
    const [inputs, setInputs] = useState({
        baselineStartX: 0,
        baselineStartY: 0,
        baselineEndX: 100,
        baselineEndY: 0,
        chainage: 50,
        offsetDistance: 10
    });
    const [result, setResult] = useState(null);

    const calculate = () => {
        const dx = inputs.baselineEndX - inputs.baselineStartX;
        const dy = inputs.baselineEndY - inputs.baselineStartY;
        const baselineLength = Math.sqrt(dx * dx + dy * dy);
        const bearing = Math.atan2(dy, dx) * (180 / Math.PI);
        const azimuth = 90 - bearing;

        const ratio = inputs.chainage / baselineLength;
        const chainageX = inputs.baselineStartX + dx * ratio;
        const chainageY = inputs.baselineStartY + dy * ratio;

        const perpBearing = inputs.offsetDistance >= 0 ? azimuth + 90 : azimuth - 90;
        const perpRad = perpBearing * (Math.PI / 180);
        const absOffset = Math.abs(inputs.offsetDistance);

        const offsetX = chainageX + absOffset * Math.cos(perpRad);
        const offsetY = chainageY + absOffset * Math.sin(perpRad);

        setResult({
            offsetX: offsetX.toFixed(3),
            offsetY: offsetY.toFixed(3),
            bearing: ((90 - azimuth + 360) % 360).toFixed(2)
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                    <Label>Baseline Start X (m)</Label>
                    <Input
                        type="number"
                        value={inputs.baselineStartX}
                        onChange={(e) => setInputs({ ...inputs, baselineStartX: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Baseline Start Y (m)</Label>
                    <Input
                        type="number"
                        value={inputs.baselineStartY}
                        onChange={(e) => setInputs({ ...inputs, baselineStartY: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Baseline End X (m)</Label>
                    <Input
                        type="number"
                        value={inputs.baselineEndX}
                        onChange={(e) => setInputs({ ...inputs, baselineEndX: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Baseline End Y (m)</Label>
                    <Input
                        type="number"
                        value={inputs.baselineEndY}
                        onChange={(e) => setInputs({ ...inputs, baselineEndY: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Chainage (m)</Label>
                    <Input
                        type="number"
                        value={inputs.chainage}
                        onChange={(e) => setInputs({ ...inputs, chainage: parseFloat(e.target.value) })}
                    />
                </div>
                <div>
                    <Label>Offset Distance (m)</Label>
                    <Input
                        type="number"
                        value={inputs.offsetDistance}
                        onChange={(e) => setInputs({ ...inputs, offsetDistance: parseFloat(e.target.value) })}
                    />
                </div>
            </div>

            <Button onClick={calculate} className="w-full">Calculate Offset</Button>

            {result && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm">
                        <span className="text-gray-600 block">Offset X:</span>
                        <span className="font-mono font-semibold">{result.offsetX} m</span>
                    </div>
                    <div className="text-sm">
                        <span className="text-gray-600 block">Offset Y:</span>
                        <span className="font-mono font-semibold">{result.offsetY} m</span>
                    </div>
                    <div className="text-sm">
                        <span className="text-gray-600 block">Bearing:</span>
                        <span className="font-mono font-semibold text-blue-600">{result.bearing}°</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// Main Dashboard
export default function SurveyingDashboard() {
    const [activeTab, setActiveTab] = useState('horizontal');

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6 bg-white min-h-full">
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Setting-Out & Construction Surveying</h1>
                <p className="text-sm text-gray-500 mt-2">Engineering-grade surveying calculations for construction projects</p>
            </div>

            <div className="space-y-6">
                {/* Custom Tabs */}
                <div className="flex p-1 bg-gray-100/80 rounded-lg border border-gray-200 max-w-2xl">
                    <TabButton active={activeTab === 'horizontal'} onClick={() => setActiveTab('horizontal')}>
                        Horizontal Curves
                    </TabButton>
                    <TabButton active={activeTab === 'vertical'} onClick={() => setActiveTab('vertical')}>
                        Vertical Curves
                    </TabButton>
                    <TabButton active={activeTab === 'deflection'} onClick={() => setActiveTab('deflection')}>
                        Deflection Table
                    </TabButton>
                    <TabButton active={activeTab === 'offset'} onClick={() => setActiveTab('offset')}>
                        Offsets
                    </TabButton>
                </div>

                <div className="mt-6">
                    {activeTab === 'horizontal' && (
                        <Card className="animate-in fade-in duration-300">
                            <CardHeader>
                                <CardTitle>Horizontal Circular Curve</CardTitle>
                                <CardDescription>Calculate simple circular curve geometry and setting-out parameters</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <HorizontalCurveCalculator />
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'vertical' && (
                        <Card className="animate-in fade-in duration-300">
                            <CardHeader>
                                <CardTitle>Vertical Parabolic Curve</CardTitle>
                                <CardDescription>Calculate vertical curve geometry and profile levels</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <VerticalCurveCalculator />
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'deflection' && (
                        <Card className="animate-in fade-in duration-300">
                            <CardHeader>
                                <CardTitle>Deflection Angle Table</CardTitle>
                                <CardDescription>Generate theodolite setting-out table for curve pegging</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DeflectionTableCalculator />
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'offset' && (
                        <Card className="animate-in fade-in duration-300">
                            <CardHeader>
                                <CardTitle>Offset Calculations</CardTitle>
                                <CardDescription>Calculate right-angle offsets from a defined baseline</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <OffsetCalculator />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <div className="mt-12 p-5 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-200">
                <div className="flex items-center gap-2 mb-3 text-gray-900 font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Engineering Field Notes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <ul className="space-y-1.5 ml-4 list-disc">
                        <li>All calculations use SI units (meters, degrees)</li>
                        <li>Horizontal curves use the **deflection angle method** (tangential angles)</li>
                        <li>Vertical curves use the parabolic equation: **y = ax² + bx + c**</li>
                    </ul>
                    <ul className="space-y-1.5 ml-4 list-disc">
                        <li>Positive offset = **Right side** (looking forward along baseline)</li>
                        <li>Bearing convention: **0° = North**, clockwise positive</li>
                        <li>Verify all peg intervals against project specifications before setting out</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}