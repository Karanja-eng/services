import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

// Import descriptions
const descriptions = {
  siteClearance: {
    code: "A.1",
    unit: "m²",
    description:
      "Site clearance including removal of vegetation, debris and topsoil to a depth not exceeding 150mm",
  },
  excavVegSoilMH: {
    code: "B.1.1",
    unit: "m²",
    description: "Excavation for manholes; vegetable soil to a depth of 150mm",
  },
  excavPitStage1: {
    code: "B.1.2",
    unit: "m³",
    description: "Excavation for manhole pits; not exceeding 1.5m depth",
  },
  excavPitStage2: {
    code: "B.1.3",
    unit: "m³",
    description: "Extra over excavation for depths exceeding 1.5m",
  },
};

// Simplified DrainageTakeoffForm Component
const DrainageTakeoffForm = ({ onCalculationComplete }) => {
  const [projectData, setProjectData] = useState({
    project_name: "Sample Drainage Project",
    veg_depth: 0.15,
    has_rock: false,
    rock_start_depth: 0,
    has_planking: false,
    ground_is_level: true,
    site_clearance_area: 100,
    manholes: [
      {
        id: "MH1",
        type: "rect",
        internal_length: 1.5,
        internal_width: 1.5,
        internal_diameter: 1.2,
        invert_level: -2.0,
        ground_level: 0.0,
        bed_thickness: 0.15,
        wall_thickness: 0.15,
        wall_material: "concrete",
        projection_thickness: 0.1,
        slab_thickness: 0.1,
        benching_avg_height: 0.2,
        has_benching: true,
        plaster_thickness: 0.012,
        has_plaster: true,
        cover_length: 0.6,
        cover_width: 0.6,
        cover_type: "heavy_duty",
        has_channel: true,
        channel_length: 1.5,
        has_step_irons: true,
        quantity: 1,
        position_x: 0,
        position_y: 0,
      },
      {
        id: "MH2",
        type: "circ",
        internal_diameter: 1.2,
        invert_level: -2.5,
        ground_level: 0.0,
        bed_thickness: 0.15,
        wall_thickness: 0.15,
        wall_material: "concrete",
        projection_thickness: 0.1,
        slab_thickness: 0.1,
        benching_avg_height: 0.2,
        has_benching: true,
        plaster_thickness: 0.012,
        has_plaster: true,
        cover_length: 0.6,
        cover_width: 0.6,
        cover_type: "heavy_duty",
        has_channel: true,
        channel_length: 0,
        has_step_irons: true,
        quantity: 1,
        position_x: 20,
        position_y: 0,
      },
    ],
    pipes: [
      {
        id: "P1",
        from_point: "House1",
        to_point: "MH1",
        length: 10.0,
        diameter_mm: 150,
        pipe_material: "upvc",
        trench_depth_start: 1.0,
        trench_depth_end: 1.5,
        trench_width: 0.6,
        bedding_type: "granular",
        surround_thickness: 0.15,
        gradient: 2.0,
        quantity: 1,
      },
      {
        id: "P2",
        from_point: "MH1",
        to_point: "MH2",
        length: 20.0,
        diameter_mm: 150,
        pipe_material: "upvc",
        trench_depth_start: 1.5,
        trench_depth_end: 2.0,
        trench_width: 0.6,
        bedding_type: "granular",
        surround_thickness: 0.15,
        gradient: 2.5,
        quantity: 1,
      },
    ],
    road_reinstatement_area: 15,
    pavement_reinstatement_area: 8,
    boundary_area: 0,
  });

  const handleCalculate = () => {
    // Mock calculation results for demonstration
    const results = {
      success: true,
      project_name: projectData.project_name,
      manholes: projectData.manholes.map((mh) => ({
        manhole_id: mh.id,
        type: mh.type,
        depth: mh.ground_level - mh.invert_level,
        veg_excav_m2: 4.5,
        excav_stage1_m3: 6.75,
        excav_stage2_m3: 2.25,
        rock_m3: 0,
        conc_bed_m3: 0.675,
        wall_conc_m2: 12.0,
        bench_nos: 1,
        channel_m: 1.5,
        slab_m3: 0.45,
        step_irons_nos: 4,
        covers_nos: 1,
        backfill_m3: 3.5,
        position: { x: mh.position_x, y: mh.position_y },
        ground_level: mh.ground_level,
        invert_level: mh.invert_level,
      })),
      pipes: projectData.pipes.map((pipe) => ({
        pipe_id: pipe.id,
        from: pipe.from_point,
        to: pipe.to_point,
        diameter_mm: pipe.diameter_mm,
        material: pipe.pipe_material,
        trench_stage1_m3: 9.0,
        trench_stage2_m3: 0,
        bedding_m3: 3.6,
        pipe_length_m: pipe.length,
        backfill_m3: 5.4,
        gradient: pipe.gradient,
        avg_depth: (pipe.trench_depth_start + pipe.trench_depth_end) / 2,
      })),
      totals: {
        manholes: {
          veg_excav_m2: 9.0,
          excav_stage1_m3: 13.5,
          excav_stage2_m3: 4.5,
          conc_bed_m3: 1.35,
          wall_conc_m2: 24.0,
          slab_m3: 0.9,
          bench_conc_m3: 0.6,
          backfill_m3: 7.0,
        },
        pipes: {
          trench_stage1_m3: 18.0,
          trench_stage2_m3: 0,
          bedding_granular_m3: 7.2,
          bedding_sand_m3: 0,
          bedding_concrete_m3: 0,
          pipe_upvc_m: 30.0,
          pipe_pcc_m: 0,
          backfill_m3: 10.8,
        },
      },
      boq_items: [
        {
          code: "A.1",
          description: "Site clearance",
          unit: "m²",
          quantity: 100,
        },
        {
          code: "B.1.1",
          description: "Excavation veg soil (manholes)",
          unit: "m²",
          quantity: 9.0,
        },
        {
          code: "B.1.2",
          description: "Excavation pits ≤1.5m",
          unit: "m³",
          quantity: 13.5,
        },
        {
          code: "B.1.3",
          description: "Extra over excav >1.5m",
          unit: "m³",
          quantity: 4.5,
        },
        {
          code: "D.1.2",
          description: "RC concrete bed",
          unit: "m³",
          quantity: 1.35,
        },
        {
          code: "D.1.3",
          description: "Concrete walls",
          unit: "m²",
          quantity: 24.0,
        },
        { code: "D.1.5", description: "Benching", unit: "No.", quantity: 2 },
        { code: "D.1.6", description: "RC slab", unit: "m³", quantity: 0.9 },
        {
          code: "F.1.1",
          description: "Manhole covers & frames",
          unit: "No.",
          quantity: 2,
        },
        { code: "F.2", description: "Step irons", unit: "No.", quantity: 8 },
        {
          code: "B.2.1",
          description: "Trench excav ≤1.5m",
          unit: "m³",
          quantity: 18.0,
        },
        {
          code: "G.2.1",
          description: "Granular bedding",
          unit: "m³",
          quantity: 7.2,
        },
        { code: "G.1.1", description: "uPVC pipes", unit: "m", quantity: 30.0 },
        { code: "H.1", description: "Backfill", unit: "m³", quantity: 17.8 },
        {
          code: "K.1.1",
          description: "Road reinstatement",
          unit: "m²",
          quantity: 15,
        },
        {
          code: "K.1.4",
          description: "Pavement reinstatement",
          unit: "m²",
          quantity: 8,
        },
        {
          code: "I.1",
          description: "Testing & commissioning",
          unit: "Item",
          quantity: 1,
        },
      ],
    };
    onCalculationComplete(results);
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-4 text-gray-800">
        Drainage Takeoff Calculator
      </h1>
      <p className="text-gray-600 mb-6">
        This is a demonstration with sample data. Click "Calculate" to generate
        takeoff and visualizations.
      </p>

      <div className="bg-blue-50 p-4 rounded mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          Sample Project Loaded:
        </h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>• Project: {projectData.project_name}</p>
          <p>
            • Manholes: {projectData.manholes.length} (MH1: Rectangular
            1.5x1.5m, MH2: Circular Ø1.2m)
          </p>
          <p>
            • Pipes: {projectData.pipes.length} runs (Total length: 30m, Ø150mm
            uPVC)
          </p>
          <p>• Ancillary works: Road and pavement reinstatement included</p>
        </div>
      </div>

      <button
        onClick={handleCalculate}
        className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition font-semibold text-lg"
      >
        Calculate Takeoff
      </button>
    </div>
  );
};

// Simplified 3D Scene Component
const DrainageScene3D = ({ projectData, calculationResults }) => {
  if (!projectData || !calculationResults) return null;

  const colors = {
    ground: 0x8b7355,
    concrete: 0xa9a9a9,
    steel: 0x708090,
    pipe_upvc: 0xff8c00,
    manhole_cover: 0x2f4f4f,
    benching: 0xc0c0c0,
    excavation: 0xd2691e,
    house: 0xdeb887,
  };

  return (
    <group>
      {/* Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={colors.ground} />
      </mesh>

      {/* Grid Helper */}
      <gridHelper
        args={[100, 20, 0x444444, 0x888888]}
        position={[0, 0.01, 0]}
      />

      {/* Manholes */}
      {projectData.manholes.map((mh, idx) => {
        const depth = mh.ground_level - mh.invert_level;
        const size =
          mh.type === "circ" ? mh.internal_diameter : mh.internal_length;

        return (
          <group
            key={idx}
            position={[mh.position_x, mh.invert_level, mh.position_y]}
          >
            {/* Base */}
            <mesh position={[0, 0.075, 0]}>
              <boxGeometry args={[size + 0.3, 0.15, size + 0.3]} />
              <meshStandardMaterial color={colors.concrete} />
            </mesh>

            {/* Walls */}
            <mesh position={[0, depth / 2, 0]}>
              {mh.type === "circ" ? (
                <cylinderGeometry
                  args={[size / 2 + 0.15, size / 2 + 0.15, depth, 16]}
                />
              ) : (
                <boxGeometry args={[size + 0.3, depth, size + 0.3]} />
              )}
              <meshStandardMaterial color={colors.concrete} wireframe />
            </mesh>

            {/* Inner space */}
            <mesh position={[0, depth / 2 + 0.1, 0]}>
              {mh.type === "circ" ? (
                <cylinderGeometry
                  args={[size / 2, size / 2, depth - 0.3, 16]}
                />
              ) : (
                <boxGeometry args={[size * 0.9, depth - 0.3, size * 0.9]} />
              )}
              <meshStandardMaterial
                color={0x000000}
                opacity={0.3}
                transparent
              />
            </mesh>

            {/* Benching */}
            {mh.has_benching && (
              <mesh position={[0, 0.25, 0]}>
                {mh.type === "circ" ? (
                  <cylinderGeometry args={[size / 2, size / 2, 0.2, 16]} />
                ) : (
                  <boxGeometry args={[size * 0.9, 0.2, size * 0.9]} />
                )}
                <meshStandardMaterial color={colors.benching} />
              </mesh>
            )}

            {/* Top Slab */}
            <mesh position={[0, depth - 0.05, 0]}>
              {mh.type === "circ" ? (
                <cylinderGeometry
                  args={[size / 2 + 0.15, size / 2 + 0.15, 0.1, 16]}
                />
              ) : (
                <boxGeometry args={[size + 0.3, 0.1, size + 0.3]} />
              )}
              <meshStandardMaterial color={colors.concrete} />
            </mesh>

            {/* Cover */}
            <mesh position={[0, depth + 0.025, 0]}>
              <boxGeometry args={[0.6, 0.05, 0.6]} />
              <meshStandardMaterial
                color={colors.manhole_cover}
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>

            {/* Step Irons */}
            {mh.has_step_irons && depth > 1.0 && (
              <>
                {[...Array(Math.floor((depth - 0.45) / 0.3))].map((_, i) => (
                  <mesh
                    key={i}
                    position={[size / 2, depth - 0.45 - i * 0.3, 0]}
                  >
                    <boxGeometry args={[0.3, 0.02, 0.05]} />
                    <meshStandardMaterial
                      color={colors.steel}
                      metalness={0.9}
                    />
                  </mesh>
                ))}
              </>
            )}
          </group>
        );
      })}

      {/* Pipes */}
      {projectData.pipes.map((pipe, idx) => {
        const fromMH = projectData.manholes.find(
          (m) => m.id === pipe.from_point
        );
        const toMH = projectData.manholes.find((m) => m.id === pipe.to_point);

        if (!toMH) return null;

        const startX = fromMH
          ? fromMH.position_x
          : toMH.position_x - pipe.length;
        const startY = fromMH
          ? fromMH.invert_level
          : toMH.invert_level + (pipe.length * pipe.gradient) / 100;
        const startZ = fromMH ? fromMH.position_y : toMH.position_y;

        const endX = toMH.position_x;
        const endY = toMH.invert_level;
        const endZ = toMH.position_y;

        const length = Math.sqrt(
          Math.pow(endX - startX, 2) +
            Math.pow(endY - startY, 2) +
            Math.pow(endZ - startZ, 2)
        );

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const midZ = (startZ + endZ) / 2;

        const dirX = endX - startX;
        const dirY = endY - startY;
        const dirZ = endZ - startZ;
        const axis = { x: 0, y: 1, z: 0 };

        return (
          <group key={idx}>
            <mesh position={[midX, midY, midZ]}>
              <cylinderGeometry
                args={[
                  pipe.diameter_mm / 2000,
                  pipe.diameter_mm / 2000,
                  length,
                  16,
                ]}
              />
              <meshStandardMaterial color={colors.pipe_upvc} />
            </mesh>
          </group>
        );
      })}

      {/* House Placeholder */}
      <group position={[-10, 0, 0]}>
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[4, 3, 5]} />
          <meshStandardMaterial color={colors.house} />
        </mesh>
        <mesh position={[0, 4, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[3.5, 2, 4]} />
          <meshStandardMaterial color={0x8b4513} />
        </mesh>
      </group>

      {/* Lights */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 15, -10]} intensity={0.4} />
    </group>
  );
};

// Simplified Takeoff Sheet
const TakeoffSheet = ({ calculationResults, projectData }) => {
  if (!calculationResults || !calculationResults.boq_items) {
    return (
      <div className="w-full p-6 bg-white rounded-lg shadow-lg">
        <p className="text-gray-500 text-center py-8">
          No results yet. Please calculate takeoff first.
        </p>
      </div>
    );
  }

  const groupedItems = calculationResults.boq_items.reduce((acc, item) => {
    const section = item.code.split(".")[0];
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const sectionTitles = {
    A: "SITE CLEARANCE",
    B: "EXCAVATION",
    D: "CONCRETE WORK",
    F: "MANHOLE FITTINGS",
    G: "PIPES & BEDDING",
    H: "BACKFILLING",
    I: "TESTING",
    K: "ANCILLARY WORKS",
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6 pb-4 border-b-2 border-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          BILL OF QUANTITIES
        </h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          DRAINAGE WORKS
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p>
              <span className="font-semibold">Project:</span>{" "}
              {projectData.project_name}
            </p>
            <p>
              <span className="font-semibold">Date:</span>{" "}
              {new Date().toLocaleDateString()}
            </p>
          </div>
          <div>
            <p>
              <span className="font-semibold">Total Manholes:</span>{" "}
              {projectData.manholes?.length || 0}
            </p>
            <p>
              <span className="font-semibold">Total Pipe Runs:</span>{" "}
              {projectData.pipes?.length || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-gray-800 text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-700 px-3 py-2 text-left w-20">
                Item No.
              </th>
              <th className="border border-gray-700 px-3 py-2 text-left">
                Description
              </th>
              <th className="border border-gray-700 px-3 py-2 text-center w-16">
                Unit
              </th>
              <th className="border border-gray-700 px-3 py-2 text-right w-24">
                Quantity
              </th>
              <th className="border border-gray-700 px-3 py-2 text-right w-24">
                Rate
              </th>
              <th className="border border-gray-700 px-3 py-2 text-right w-28">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sectionTitles).map(
              ([sectionCode, sectionTitle]) => {
                const items = groupedItems[sectionCode];
                if (!items) return null;

                return (
                  <React.Fragment key={sectionCode}>
                    <tr className="bg-gray-100">
                      <td
                        colSpan="6"
                        className="border border-gray-700 px-3 py-2 font-bold"
                      >
                        {sectionCode}. {sectionTitle}
                      </td>
                    </tr>

                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border border-gray-700 px-3 py-2 font-mono text-xs">
                          {item.code}
                        </td>
                        <td className="border border-gray-700 px-3 py-2">
                          {item.description}
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-center font-semibold">
                          {item.unit}
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-right font-mono">
                          {typeof item.quantity === "number"
                            ? item.quantity.toFixed(2)
                            : item.quantity}
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-right text-gray-400">
                          -
                        </td>
                        <td className="border border-gray-700 px-3 py-2 text-right text-gray-400">
                          -
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              }
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold text-gray-800 mb-2">Summary</h3>
        <p className="text-sm text-gray-700">
          Total Items: {calculationResults.boq_items.length}
        </p>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [activeView, setActiveView] = useState("form");
  const [projectData, setProjectData] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);

  const handleCalculationComplete = (results) => {
    setCalculationResults(results);
    setActiveView("takeoff");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6 p-4">
          <div className="flex space-x-2">
            {["form", "takeoff", "3d"].map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                disabled={view !== "form" && !calculationResults}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  activeView === view
                    ? "bg-blue-600 text-white"
                    : view !== "form" && !calculationResults
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {view === "form"
                  ? "Input Form"
                  : view === "takeoff"
                  ? "Takeoff Sheet"
                  : "3D View"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeView === "form" && (
          <DrainageTakeoffForm
            onCalculationComplete={(results) => {
              setCalculationResults(results);
              setProjectData(results);
              handleCalculationComplete(results);
            }}
          />
        )}

        {activeView === "takeoff" && calculationResults && (
          <TakeoffSheet
            calculationResults={calculationResults}
            projectData={calculationResults}
          />
        )}

        {activeView === "3d" && calculationResults && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-800 text-white">
              <h2 className="text-xl font-bold">3D Visualization</h2>
              <p className="text-sm text-gray-300">
                Use mouse to rotate, zoom, and pan the view
              </p>
            </div>
            <div style={{ height: "600px" }}>
              <Canvas>
                <PerspectiveCamera makeDefault position={[30, 25, 30]} />
                <OrbitControls />
                <DrainageScene3D
                  projectData={calculationResults}
                  calculationResults={calculationResults}
                />
              </Canvas>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
