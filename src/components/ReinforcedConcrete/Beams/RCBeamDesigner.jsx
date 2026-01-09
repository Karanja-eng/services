import React, { useState } from "react";
import axios from "axios";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Zap,
  Download,
  ChevronRight,
  Play,
  ArrowLeft,
  Info,
  Box,
  Monitor,
  FileText
} from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Environment } from "@react-three/drei";
import BeamColumnDrawer from "./BeamDrawer";
import { MultiSpanBeam3D } from "./Beam_THree";

/**
 * RCBeamDesigner - A unified component for BS 8110 Beam Design
 * Accepts analysis results and upstream design parameters.
 */
const RCBeamDesigner = ({
  analysisResults,
  designParams, // Passed from parent
  analysisMethod = "Continuous",
  isDark = false,
  onBack // Function to go back to analysis
}) => {
  const API_BASE_URL = "http://localhost:8001/beam_analysis/rc_design";

  const [designResults, setDesignResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Viewer States
  const [show2DDrawer, setShow2DDrawer] = useState(false);
  const [show3DViewer, setShow3DViewer] = useState(false);

  React.useEffect(() => {
    if (analysisResults && designParams) {
      runDesign();
    }
  }, [analysisResults]);

  const runDesign = async () => {
    if (!analysisResults) return;

    setLoading(true);
    setError(null);

    try {
      let endpoint = `${API_BASE_URL}/integrate_analysis_design`;
      let payload = {
        analysis_results: analysisResults,
        design_parameters: designParams, // Use props
      };

      if (analysisMethod === "moment-distribution") {
        endpoint = `${API_BASE_URL}/integrated/moment_distribution_design`;
        payload = {
          md_results: analysisResults,
          design_parameters: designParams,
        };
      }

      console.log("Using endpoint:", endpoint);
      console.log("Analysis Method:", analysisMethod);

      const response = await axios.post(endpoint, payload);
      setDesignResults(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Design integration failed.");
    } finally {
      setLoading(false);
    }
  };

  /* Helper to map a specific span design to 2D Drawer Config */
  const get2DConfig = (span, spanIndex) => {
    if (!span || !designParams) return {};
    const isTeel = designParams.beam_type === "T-Beam";
    const isEll = designParams.beam_type === "L-Beam";

    return {
      type: isTeel ? "t_beam" : (isEll ? "l_beam" : "flangless_beam"),
      webWidth: designParams.web_width || designParams.width || 300,
      beamDepth: designParams.depth || 500,
      flangeThk: designParams.flange_thickness || 150,
      flangeWidth: designParams.flange_width || 1000,
      cover: designParams.cover || 25,

      // Reinforcement Data from Span Results
      saggingBarsCount: span.sagging_bars_count,
      saggingBarDiameter: span.sagging_bars_diameter,
      saggingCompCount: span.sagging_compression_bars_count,
      saggingCompDia: span.sagging_compression_bars_diameter,

      hoggingBarsCount: span.hogging_bars_count,
      hoggingBarDiameter: span.hogging_bars_diameter,
      hoggingCompCount: span.hogging_compression_bars_count,
      hoggingCompDia: span.hogging_compression_bars_diameter,

      linksDiameter: span.shear_links_diameter,
    };
  };

  /* Helper to map all spans to 3D Config */
  const get3DSpans = () => {
    if (!designResults) return [];
    const spans = designResults.span_designs || designResults.member_designs || [];

    return spans.map(span => ({
      spanLength: span.span_length,
      beamWidth: (designParams.web_width || designParams.width || 300) / 1000,
      beamDepth: (designParams.depth || 500) / 1000,
      cover: (designParams.cover || 25) / 1000,

      saggingBarsCount: span.sagging_bars_count,
      saggingBarDiameter: span.sagging_bars_diameter / 1000,
      saggingCompressionBarsCount: span.sagging_compression_bars_count,
      saggingCompressionBarDiameter: span.sagging_compression_bars_diameter / 1000,

      hoggingBarsCountLeft: span.hogging_bars_count,
      hoggingBarDiameterLeft: span.hogging_bars_diameter / 1000,
      hoggingBarsCountRight: span.hogging_bars_count,
      hoggingBarDiameterRight: span.hogging_bars_diameter / 1000,

      linksDiameter: span.shear_links_diameter / 1000,
      linksSpacing: span.shear_links_spacing / 1000
    }));
  };

  const downloadDXF = async () => {
    if (!designParams) return;

    try {
      setLoading(true);
      // Combine design params with results if available to get actual steel
      // For now using default or first span results if complex
      // Ideally we iterate spans or ask user which span. 
      // Defaulting to "Rectangular" or params type.

      // Find reinforcement from first span if available
      let topSteel = { count: 2, diameter: 16 };
      let botSteel = { count: 3, diameter: 20 };

      if (designResults && (designResults.span_designs || designResults.member_designs)) {
        const span = (designResults.span_designs || designResults.member_designs)[0];
        if (span) {
          topSteel = { count: span.hogging_bars_count, diameter: span.hogging_bars_diameter };
          botSteel = { count: span.sagging_bars_count, diameter: span.sagging_bars_diameter };
        }
      }

      const payload = {
        ...designParams,
        top_steel: topSteel,
        bot_steel: botSteel,
        width: designParams.width || designParams.web_width || 300,
        depth: designParams.depth || 500
      };

      const response = await axios.post("http://localhost:8001/api/export-dxf", payload, {
        responseType: 'blob', // Important
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beam_${designParams.beam_type || 'detail'}.dxf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {
      console.error("DXF Export failed", err);
      setError("Failed to export DXF.");
    } finally {
      setLoading(false);
    }
  };

  if (!analysisResults) return null;

  return (
    <div className={`space-y-6 ${isDark ? "text-white" : "text-gray-900"}`}>
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition">
              <ArrowLeft className="h-6 w-6 text-gray-500" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-blue-600 h-8 w-8" />
              BS 8110 Design Results
            </h2>
            <p className="text-sm text-gray-500">
              Based on {analysisMethod} analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Visualisation Buttons */}
          <button
            onClick={() => setShow2DDrawer(true)}
            className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-bold transition flex items-center gap-2"
          >
            <Box className="h-4 w-4" /> 2D Section
          </button>
          <button
            onClick={() => setShow3DViewer(true)}
            className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-bold transition flex items-center gap-2"
          >
            <Monitor className="h-4 w-4" /> 3D Model
          </button>
          <button
            onClick={downloadDXF}
            className="px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-bold transition flex items-center gap-2"
          >
            <FileText className="h-4 w-4" /> Export CAD
          </button>

          <div className="text-right mr-4 hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase">Concrete</p>
            <p className="font-bold">C{designParams?.fcu || 30}</p>
          </div>
          <div className="text-right mr-4 hidden md:block">
            <p className="text-xs font-bold text-gray-400 uppercase">Steel</p>
            <p className="font-bold">fy={designParams?.fy || 460}</p>
          </div>
          <button
            onClick={runDesign}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-md transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? "Calculating..." : <><Play className="h-4 w-4" /> Re-Run</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {loading && !designResults && (
        <div className="py-20 text-center">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Performing BS 8110 Checks...</p>
        </div>
      )}

      {designResults && (
        <div className="space-y-8">
          {/* Summary Status */}
          <div className={`p-6 rounded-2xl border-l-8 flex items-center justify-between shadow-sm ${designResults.summary.all_designs_ok
            ? "bg-green-50 dark:bg-green-900/10 border-green-500"
            : "bg-red-50 dark:bg-red-900/10 border-red-500"
            }`}>
            <div className="flex items-center gap-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${designResults.summary.all_designs_ok ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                }`}>
                {designResults.summary.all_designs_ok ? <CheckCircle className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
              </div>
              <div>
                <h3 className={`text-xl font-bold ${designResults.summary.all_designs_ok ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
                  {designResults.summary.all_designs_ok ? "Design Compliant" : "Design Issues Detected"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {designResults.summary.all_designs_ok
                    ? "All spans satisfy BS 8110 requirements for flexure, shear, and serviceability."
                    : "One or more checks failed. Please review the detailed span results below."}
                </p>
              </div>
            </div>
            <button className="flex items-center gap-2 text-blue-600 font-bold hover:underline">
              <Download className="h-5 w-5" /> Export PDF
            </button>
          </div>

          {/* Detailed Span Cards */}
          <div className="space-y-6">
            {(designResults.span_designs || designResults.member_designs || []).map((span, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 overflow-hidden">

                {/* Span Header */}
                <div className="bg-gray-50 dark:bg-slate-700/50 px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-slate-700">
                  <h4 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm">Span {idx + 1}</span>
                    {span.span_length?.toFixed(2)}m
                  </h4>
                  <div className="flex gap-2">
                    {/* Badges for checks */}
                    <StatusBadge label="Flexure" ok={span.design_checks.moment_capacity_ok} />
                    <StatusBadge label="Shear" ok={span.design_checks.shear_capacity_ok} />
                    <StatusBadge label="Deflection" ok={span.design_checks.deflection_ok} />
                    <StatusBadge label="Cover" ok={span.design_checks.cover_ok} />
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                  {/* 1. Main Reinforcement (Sagging) */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-gray-500 uppercase text-xs tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div> Bottom Reinforcement (Sagging)
                    </h5>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                      <p className="text-sm text-gray-500 mb-1">Design Moment: <span className="text-gray-900 dark:text-white font-bold">{span.sagging_moment?.toFixed(1)} kNm</span></p>

                      {/* Tension */}
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                        {span.sagging_bars_count} T{span.sagging_bars_diameter}
                      </p>
                      <p className="text-xs text-blue-600/70 mt-1 mb-2">
                        Provided: {span.sagging_As_provided?.toFixed(0)} mm² (Req: {span.sagging_As_required?.toFixed(0)})
                      </p>

                      {/* Compression (If Doubly Reinforced) */}
                      {span.sagging_compression_needed && (
                        <div className="pt-2 border-t border-blue-200 dark:border-blue-800/50 mt-2">
                          <p className="text-xs font-bold text-blue-800 dark:text-blue-200">Compression Steel (Top):</p>
                          <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                            {span.sagging_compression_bars_count} T{span.sagging_compression_bars_diameter}
                          </p>
                          <p className="text-xs text-blue-600/70">
                            Prov: {span.sagging_compression_As_provided?.toFixed(0)} mm²
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Top Reinforcement (Hogging) */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-gray-500 uppercase text-xs tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div> Top Reinforcement (Supports)
                    </h5>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800/30">
                      <p className="text-sm text-gray-500 mb-1">Design Moment: <span className="text-gray-900 dark:text-white font-bold">{Math.abs(span.hogging_moment_left || 0).toFixed(1)} kNm</span></p>

                      {/* Tension */}
                      <p className="text-2xl font-black text-orange-700 dark:text-orange-300">
                        {span.hogging_bars_count} T{span.hogging_bars_diameter}
                      </p>
                      <p className="text-xs text-orange-600/70 mt-1 mb-2">
                        Provided: {span.hogging_As_provided?.toFixed(0)} mm² (Req: {span.hogging_As_required_left?.toFixed(0)})
                      </p>

                      {/* Compression (If Doubly Reinforced) */}
                      {span.hogging_compression_needed && (
                        <div className="pt-2 border-t border-orange-200 dark:border-orange-800/50 mt-2">
                          <p className="text-xs font-bold text-orange-800 dark:text-orange-200">Compression Steel (Bottom):</p>
                          <p className="text-lg font-bold text-orange-800 dark:text-orange-200">
                            {span.hogging_compression_bars_count} T{span.hogging_compression_bars_diameter}
                          </p>
                          <p className="text-xs text-orange-600/70">
                            Prov: {span.hogging_compression_As_provided?.toFixed(0)} mm²
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Shear Reinforcement */}
                  <div className="space-y-3">
                    <h5 className="font-bold text-gray-500 uppercase text-xs tracking-wider flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div> Shear Links
                    </h5>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30">
                      <p className="text-sm text-gray-500 mb-1">Design Shear: <span className="text-gray-900 dark:text-white font-bold">{span.shear_max?.toFixed(1)} kN</span></p>
                      <p className="text-2xl font-black text-purple-700 dark:text-purple-300">
                        H{span.shear_links_diameter} @ {span.shear_links_spacing}
                      </p>
                      <p className="text-xs text-purple-600/70 mt-1">
                        {span.shear_link_legs} Legs
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warnings & Checks Section */}
                {span.design_checks?.warnings?.length > 0 && (
                  <div className="px-6 pb-6">
                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                      <h5 className="font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" /> Design Notes & Warnings
                      </h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-amber-900/80 dark:text-amber-300/80">
                        {span.design_checks.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Deflection Detail */}
                {!span.design_checks?.deflection_ok && (
                  <div className="px-6 pb-6 text-red-600 text-sm font-bold">
                    Deflection Fail: L/d Actual {span.design_checks?.actual_L_d?.toFixed(1)} &gt; Allowable {span.design_checks?.allowable_L_d?.toFixed(1)}
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2D Beam Drawer Modal */}
      {show2DDrawer && designResults?.span_designs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-xl">2D Detailing Sections</h3>
              <button onClick={() => setShow2DDrawer(false)} className="text-gray-500 hover:text-gray-800 font-bold">Close</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-12">
              {designResults.span_designs.map((span, idx) => (
                <div key={idx} className="border rounded-xl p-4 shadow-sm">
                  <h4 className="font-bold text-lg mb-4 text-center bg-gray-100 py-2 rounded">Span {idx + 1} ({span.span_length}m)</h4>
                  <BeamColumnDrawer
                    config={get2DConfig(span, idx)}
                    section="both"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D Viewer Modal */}
      {show3DViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full h-full relative">
            <button
              onClick={() => setShow3DViewer(false)}
              className="absolute top-6 right-6 z-50 px-6 py-2 bg-white text-black rounded-full shadow-lg font-bold hover:bg-gray-100 transition"
            >
              Close 3D View
            </button>

            <div className="w-full h-full">
              <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
                <color attach="background" args={[isDark ? "#101010" : "#f0f0f0"]} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                <Environment preset="city" />

                <OrbitControls makeDefault />

                <Stage intensity={0.5} environment="city">
                  <MultiSpanBeam3D spans={get3DSpans()} />
                </Stage>
              </Canvas>
            </div>

            {/* Legend Overlay */}
            <div className="absolute bottom-10 left-10 bg-white/90 p-4 rounded-xl shadow-lg backdrop-blur text-xs text-gray-800 max-w-xs">
              <h4 className="font-bold mb-2">3D Reinforcement Model</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded-full"></div> Main Steel (Red)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded-full"></div> Links (Blue)</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-600 rounded-full"></div> Supports (Gray)</div>
              </div>
              <p className="mt-2 text-gray-500 italic">Scroll to zoom • Drag to rotate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ label, ok }) => (
  <div className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}>
    {ok ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
    {label}
  </div>
);

export default RCBeamDesigner;
