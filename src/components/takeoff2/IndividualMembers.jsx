import React, { useState } from "react";
import axios from "axios";
import {
  Building,
  Layers,
  Home,
  Square,
  TreePine,
  Waves,
  ArrowLeft,
  Calculator,
  Droplets
} from "lucide-react";
import EnglishMethodTakeoffSheet from "./ExternalWorks/EnglishMethodTakeoffSheet";
import { UniversalTabs, UniversalSheet, UniversalBOQ } from './universal_component';

const IndividualMembers = ({ onViewDiagram, onGoToBOQ, onGoToApproximate }) => {
  const [activeTab, setActiveTab] = useState("calculator");
  const [takeoffData, setTakeoffData] = useState([]);
  const [editorKey, setEditorKey] = useState(0);

  const [activeCalculator, setActiveCalculator] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({});

  const API_BASE_URL = "http://localhost:8000/api";

  const memberCalculators = [
    {
      id: "stairs", name: "Stairs", icon: Building, color: "blue", description: "Stairs concrete, formwork & reinforcement",
      fields: [
        { name: "height", label: "Total Height (m)", type: "number", required: true },
        { name: "length", label: "Total Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "riser_height", label: "Riser Height (mm)", type: "number", defaultValue: 175 },
        { name: "tread_width", label: "Tread Width (mm)", type: "number", defaultValue: 250 },
        { name: "thickness", label: "Waist Thickness (mm)", type: "number", defaultValue: 150 },
      ]
    },
    {
      id: "foundation", name: "Foundation", icon: Layers, color: "gray", description: "Foundation excavation & concrete",
      fields: [
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
        { name: "concrete_grade", label: "Grade", type: "select", options: ["C15", "C20", "C25"], defaultValue: "C20" },
      ]
    },
    {
      id: "superstructure", name: "Superstructure", icon: Home, color: "green", description: "Beams, columns, slabs",
      fields: [
        { name: "floor_area", label: "Floor Area (m²)", type: "number", required: true },
        { name: "storey_height", label: "Storey Height (m)", type: "number", defaultValue: 3 },
        { name: "number_floors", label: "Stories", type: "number", defaultValue: 1 },
        { name: "slab_thickness", label: "Slab Thk (mm)", type: "number", defaultValue: 150 },
      ]
    },
    {
      id: "manholes", name: "Manholes", icon: Square, color: "yellow", description: "Manhole excavation & concrete",
      fields: [
        { name: "internal_diameter", label: "Int. Diameter (mm)", type: "number", defaultValue: 1050 },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
        { name: "number_manholes", label: "Count", type: "number", defaultValue: 1 },
      ]
    },
    {
      id: "pavements", name: "Pavements", icon: Square, color: "purple", description: "Pavement layers",
      fields: [
        { name: "area", label: "Area (m²)", type: "number", required: true },
        { name: "subbase_thickness", label: "Sub-base (mm)", type: "number", defaultValue: 150 },
        { name: "base_thickness", label: "Base (mm)", type: "number", defaultValue: 150 },
        { name: "surface_thickness", label: "Surface (mm)", type: "number", defaultValue: 50 },
      ]
    },
    {
      id: "retaining_walls", name: "Retaining Walls", icon: Building, color: "red", description: "Retaining wall concrete",
      fields: [
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "height", label: "Height (m)", type: "number", required: true },
        { name: "thickness", label: "Thickness (mm)", type: "number", defaultValue: 200 },
        { name: "foundation_width", label: "Found. Width (m)", type: "number", defaultValue: 1.0 },
      ]
    },
    {
      id: "septic_tanks", name: "Septic Tanks", icon: Droplets, color: "teal", description: "Excavation & Construction",
      fields: [
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "depth", label: "Depth (m)", type: "number", required: true },
      ]
    },
    {
      id: "swimming_pools", name: "Swimming Pools", icon: Waves, color: "cyan", description: "Pool excavation & concrete",
      fields: [
        { name: "length", label: "Length (m)", type: "number", required: true },
        { name: "width", label: "Width (m)", type: "number", required: true },
        { name: "avg_depth", label: "Avg Depth (m)", type: "number", required: true, defaultValue: 1.5 },
      ]
    }
  ];

  const handleCalculatorSelect = (calc) => {
    setActiveCalculator(calc);
    setFormData({}); // Reset form
    setTakeoffData([]);
  };

  const calculate = async () => {
    if (!activeCalculator) return;
    setIsLoading(true);

    // Simulate API or Mock
    setTimeout(() => {
      const results = mockCalculate(activeCalculator.id, formData);
      setTakeoffData(results);
      setEditorKey(prev => prev + 1);
      setIsLoading(false);
    }, 600);
  };

  const mockCalculate = (id, data) => {
    const items = [];
    let itemCounter = 1;
    const makeItem = (desc, unit, qty, rate, dims) => ({
      id: itemCounter++, billNo: "X", itemNo: itemCounter.toString(), description: desc, unit, quantity: qty, rate, amount: qty * rate, dimensions: dims, isHeader: false
    });
    const makeHeader = (desc) => ({ id: itemCounter++, description: desc, isHeader: true });

    try {
      switch (id) {
        case "stairs":
          // Simple Stair Logic
          items.push(makeHeader("STAIRCASE"));
          const sL = parseFloat(data.length) || 0;
          const sW = parseFloat(data.width) || 0;
          const sH = parseFloat(data.height) || 0;
          const sThk = parseFloat(data.thickness) / 1000 || 0.15;

          // Waist Vol = Length * Width * Thickness (Sloped length actually, approx sqrt(L^2+H^2))
          const slopeL = Math.sqrt(sL * sL + sH * sH);
          const waistVol = slopeL * sW * sThk;

          // Steps Vol = 0.5 * R * T * N_steps * Width
          // R = riser, T = tread. N = H/R.
          // Total Step Vol = 0.5 * L * H * Width ? (Area of triangle under steps * Width)
          const stepsVol = 0.5 * sL * sH * sW;

          const totalVol = waistVol + stepsVol;

          items.push(makeItem("Reinforced Concrete (Grade 25) in Stairs", "m³", totalVol, 13500, [
            { number: 1, length: slopeL.toFixed(2), width: sW.toFixed(2), height: sThk.toFixed(2), text: "Waist" },
            { number: 1, length: sL.toFixed(2), width: sW.toFixed(2), height: sH.toFixed(2), multiplier: 0.5, text: "Steps (Triangle)" }
          ]));

          // Formwork (Soffit + Risers + Sides)
          const soffit = slopeL * sW;
          // Risers area = W * H_total
          const risersArea = sW * sH;
          // Sides = (Waist side + Steps side) * 2
          // Approx side area = (slopeL * sThk) + (0.5 * sL * sH)
          const sidesArea = 2 * ((slopeL * sThk) + (0.5 * sL * sH));

          items.push(makeItem("Formwork to Soffits", "m²", soffit, 1200, [{ number: 1, length: slopeL.toFixed(2), width: sW.toFixed(2) }]));
          items.push(makeItem("Formwork to Risers", "m²", risersArea, 1200, [{ number: 1, length: sW.toFixed(2), width: sH.toFixed(2) }]));
          items.push(makeItem("Formwork to Sides (Stringers)", "m²", sidesArea, 1200, [{ number: 2, length: "Area", text: "Sides Custom" }])); // simplified

          break;

        case "foundation":
          items.push(makeHeader("FOUNDATION"));
          const fL = parseFloat(data.length);
          const fW = parseFloat(data.width);
          const fD = parseFloat(data.depth);

          // Excavation
          const fExc = fL * fW * fD;
          items.push(makeItem(`Excavation for footing ne ${fD}m deep`, "m³", fExc, 450,
            [{ number: 1, length: fL.toFixed(2), width: fW.toFixed(2), height: fD.toFixed(2) }]
          ));
          // Concrete (assume fill)
          items.push(makeItem(`Concrete ${data.concrete_grade || "C20"} in footing`, "m³", fExc, 12000,
            [{ number: 1, length: fL.toFixed(2), width: fW.toFixed(2), height: fD.toFixed(2) }]
          ));
          break;

        case "superstructure":
          items.push(makeHeader("SUPERSTRUCTURE FRAME"));
          const flArea = parseFloat(data.floor_area);
          const nFl = parseFloat(data.number_floors);
          const stH = parseFloat(data.storey_height);
          const slThk = parseFloat(data.slab_thickness) / 1000;

          // Slabs
          const slabVol = flArea * slThk * nFl;
          items.push(makeItem("RC in Slabs", "m³", slabVol, 13500, [{ number: nFl, length: flArea.toFixed(2), width: slThk.toFixed(2), text: "Area * Thk" }]));

          // Columns (Estimate 1 col per 15m2 ?)
          // Heuristic from previous code: col vol = floors * height * 0.02 * area (very rough)
          // Let's use simple logic: 
          const colVol = nFl * stH * (flArea * 0.02); // 2% of volume? No, previous logic.
          items.push(makeItem("RC in Columns (Est)", "m³", colVol, 13500, [{ number: 1, length: colVol.toFixed(2), text: "Estimate" }]));

          break;

        case "manholes":
          items.push(makeHeader("MANHOLES"));
          const mhD = parseFloat(data.depth);
          const mhDiam = parseFloat(data.internal_diameter) / 1000;
          const count = parseFloat(data.number_manholes);

          // Excavation (approx 1.5m diam hole for 1m diam mh)
          const excDiam = mhDiam + 0.5;
          const mhExc = (Math.PI * Math.pow(excDiam, 2) / 4) * mhD * count;

          items.push(makeItem("Excavation for Manholes", "m³", mhExc, 550, [
            { number: count, length: (Math.PI / 4).toFixed(2), width: excDiam.toFixed(2), height: (excDiam * mhD).toFixed(2) }
          ]));

          items.push(makeItem("Precast Manhole Rings", "m", mhD * count, 4500, [{ number: count, length: mhD.toFixed(2) }]));
          items.push(makeItem("Manhole Covers", "No", count, 8500, [{ number: count, length: 1 }]));
          break;

        case "pavements":
          items.push(makeHeader("PAVEMENTS"));
          const pArea = parseFloat(data.area);
          const sbT = parseFloat(data.subbase_thickness) / 1000;
          const bT = parseFloat(data.base_thickness) / 1000;

          items.push(makeItem("Sub-base Compaction", "m³", pArea * sbT, 3500, [{ number: 1, length: pArea.toFixed(2), width: sbT.toFixed(2) }]));
          items.push(makeItem("Base Course", "m³", pArea * bT, 4500, [{ number: 1, length: pArea.toFixed(2), width: bT.toFixed(2) }]));
          items.push(makeItem("Paving Blocks / Surface", "m²", pArea, 1200, [{ number: 1, length: pArea.toFixed(2) }]));
          break;

        case "retaining_walls":
          items.push(makeHeader("RETAINING WALL"));
          const rwL = parseFloat(data.length);
          const rwH = parseFloat(data.height);
          const rwThk = parseFloat(data.thickness) / 1000;
          const rwFW = parseFloat(data.foundation_width);

          // Wall
          const rwVol = rwL * rwH * rwThk;
          items.push(makeItem("RC Retaining Wall", "m³", rwVol, 13500, [{ number: 1, length: rwL.toFixed(2), height: rwH.toFixed(2), width: rwThk.toFixed(2) }]));
          // Found (assume 0.3 thk)
          const rwFVol = rwL * rwFW * 0.3;
          items.push(makeItem("RC Foundation", "m³", rwFVol, 12500, [{ number: 1, length: rwL.toFixed(2), width: rwFW.toFixed(2), height: "0.30" }]));
          break;

        case "septic_tanks":
          items.push(makeHeader("SEPTIC TANK"));
          const stL = parseFloat(data.length);
          const stW = parseFloat(data.width);
          const stD = parseFloat(data.depth);

          const stExc = (stL + 1) * (stW + 1) * stD; // working space
          items.push(makeItem("Excavation", "m³", stExc, 450, [{ number: 1, length: (stL + 1).toFixed(2), width: (stW + 1).toFixed(2), height: stD.toFixed(2) }]));
          items.push(makeItem("Concrete Bed", "m³", stL * stW * 0.15, 12500, [{ number: 1, length: stL.toFixed(2), width: stW.toFixed(2), height: "0.15" }]));
          break;

        case "swimming_pools":
          items.push(makeHeader("SWIMMING POOL"));
          const spL = parseFloat(data.length);
          const spW = parseFloat(data.width);
          const spD = parseFloat(data.avg_depth);

          const spExc = spL * spW * spD;
          items.push(makeItem("Bulk Excavation", "m³", spExc, 450, [{ number: 1, length: spL.toFixed(2), width: spW.toFixed(2), height: spD.toFixed(2) }]));
          // Shell (approx area * 0.2 thk)
          const shellArea = (spL * spW) + 2 * (spL * spD) + 2 * (spW * spD);
          const shellVol = shellArea * 0.2;
          items.push(makeItem("RC Shell (Floor & Walls)", "m³", shellVol, 14500, [{ number: 1, length: shellArea.toFixed(2), width: "0.20", text: "Total Surface * Thk" }]));
          break;

        default:
          break;
      }
    } catch (e) { console.error(e); }
    return items;
  };

  return (
    <div className="flex bg-gray-50 h-screen flex-col">
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-none">
        <div className="flex items-center gap-3 mb-4">
          {activeCalculator ? (
            <button onClick={() => setActiveCalculator(null)} className="p-2 hover:bg-gray-100 rounded-full mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Calculator className="w-8 h-8 text-blue-700" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeCalculator ? activeCalculator.name : "Quick Calculators"}
            </h1>
            <p className="text-sm text-gray-500">
              {activeCalculator ? activeCalculator.description : "Select a component to estimate"}
            </p>
          </div>
        </div>
        <UniversalTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabs={['calculator', 'takeoff', 'sheet', 'boq']}
        />
      </div>

      <main className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {activeTab === 'calculator' && (
          <>
            {!activeCalculator ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {memberCalculators.map((calc) => (
                  <div
                    key={calc.id}
                    onClick={() => handleCalculatorSelect(calc)}
                    className="bg-white p-6 rounded-xl shadow-sm border hover:border-blue-500 hover:shadow-md cursor-pointer transition-all flex flex-col items-center text-center group"
                  >
                    <div className={`p-4 rounded-full bg-${calc.color}-50 text-${calc.color}-600 mb-4 group-hover:scale-110 transition-transform`}>
                      <calc.icon className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-800">{calc.name}</h3>
                    <p className="text-sm text-gray-500 mt-2">{calc.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeCalculator.fields.map((field) => (
                      <div key={field.name} className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                        {field.type === 'select' ? (
                          <select
                            className="border rounded px-3 py-2"
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                            value={formData[field.name] || field.defaultValue || ""}
                          >
                            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            className="border rounded px-3 py-2"
                            placeholder={field.defaultValue}
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                            value={formData[field.name] || ""}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border p-6 h-fit">
                  <button
                    onClick={calculate}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-5 h-5" /> {isLoading ? "Calculating..." : "Calculate"}
                  </button>
                  {takeoffData.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                      Calculations complete. Check Tabs.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'takeoff' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <EnglishMethodTakeoffSheet
              key={editorKey}
              initialItems={takeoffData}
              onChange={setTakeoffData}
              projectInfo={{
                projectName: activeCalculator ? activeCalculator.name : "Quick Calc",
                clientName: "",
                projectDate: new Date().toLocaleDateString()
              }}
            />
          </div>
        )}

        {activeTab === 'sheet' && <div className="h-full"><UniversalSheet items={takeoffData} /></div>}
        {activeTab === 'boq' && <div className="h-full"><UniversalBOQ items={takeoffData} /></div>}
      </main>
    </div>
  );
};

export default IndividualMembers;
