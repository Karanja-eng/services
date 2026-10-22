import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Shield,
  Play,
  Info,
  Box,
  Monitor,
  FileText,
  Ruler,
} from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, Environment } from "@react-three/drei";
import BeamColumnDrawer from "./BeamDrawer";
import { MultiSpanBeam3D } from "./Beam_THree";
import {
  WorkspacePage,
  PageHeader,
  Section,
  ResultBanner,
  StatusBadge,
  ViewerModal,
  ErrorNotice,
  LoadingState,
  MetaChip,
  TechnicalDetails,
  action,
  text,
} from "../../shared/ui";

/**
 * RCBeamDesigner - A unified component for BS 8110 Beam Design
 * Accepts analysis results and upstream design parameters.
 *
 * UI cleanup notes:
 * - Same endpoints, same payloads, same state. Only presentation changed.
 * - 2D/3D viewers now use the shared `ViewerModal` (full-screen on phones,
 *   dialog on desktop, Escape/focus handling, scroll lock).
 * - Per-check results use the shared `StatusBadge` (always prints PASS/FAIL) so
 *   colour is never the only signal.
 * - The previous "Export PDF" control had no handler; it is replaced by an
 *   explicit instruction rather than a button that silently does nothing.
 */
const RCBeamDesigner = ({
  analysisResults,
  designParams, // Passed from parent
  analysisMethod = "Continuous",
  isDark = false,
  onBack, // Function to go back to analysis
}) => {
  const navigate = useNavigate();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      type: isTeel ? "t_beam" : isEll ? "l_beam" : "flangless_beam",
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

    return spans.map((span) => ({
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
      linksSpacing: span.shear_links_spacing / 1000,
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
        depth: designParams.depth || 500,
      };

      const response = await axios.post("http://localhost:8001/api/export-dxf", payload, {
        responseType: "blob", // Important
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `beam_${designParams.beam_type || "detail"}.dxf`);
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

  const spans = designResults?.span_designs || designResults?.member_designs || [];
  const allOk = Boolean(designResults?.summary?.all_designs_ok);

  return (
    <WorkspacePage width="default">
      <PageHeader
        title="BS 8110 design results"
        subtitle={`Based on ${analysisMethod} analysis · all checks reported per span`}
        icon={<Shield size={22} aria-hidden="true" />}
        onBack={onBack}
        backLabel="Back to analysis"
        meta={
          <>
            <MetaChip tone="neutral">Concrete C{designParams?.fcu || 30}</MetaChip>
            <MetaChip tone="neutral">Steel fy={designParams?.fy || 460} N/mm²</MetaChip>
            <MetaChip tone="neutral">
              {designParams?.beam_type || "Rectangular"} section
            </MetaChip>
          </>
        }
        actions={
          <button
            type="button"
            onClick={runDesign}
            disabled={loading}
            className={`${action.base} ${action.primary}`}
          >
            {loading ? (
              "Calculating…"
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" /> Re-run design
              </>
            )}
          </button>
        }
      />

      {/* Viewer / export actions: wrapped on phones, inline on desktop. */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShow2DDrawer(true)}
          disabled={spans.length === 0}
          className={`${action.base} ${action.secondary}`}
        >
          <Box className="h-4 w-4" aria-hidden="true" /> 2D sections
        </button>
        <button
          type="button"
          onClick={() => setShow3DViewer(true)}
          disabled={spans.length === 0}
          className={`${action.base} ${action.secondary}`}
        >
          <Monitor className="h-4 w-4" aria-hidden="true" /> 3D reinforcement
        </button>
        <button
          type="button"
          onClick={downloadDXF}
          disabled={loading}
          className={`${action.base} ${action.secondary}`}
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> Export DXF
        </button>
      </div>

      {error && (
        <ErrorNotice
          className="mb-4"
          title="Beam design could not be completed"
          message={error}
          onRetry={runDesign}
        />
      )}

      {loading && !designResults && (
        <LoadingState
          label="Performing BS 8110 checks…"
          detail="Flexure, shear links, cover and span/depth deflection are evaluated per span."
        />
      )}

      {designResults && (
        <div className="space-y-5 sm:space-y-6">
          {/* Summary status */}
          <ResultBanner
            status={allOk ? "pass" : "fail"}
            title={allOk ? "Design compliant" : "Design issues detected"}
            description={
              allOk
                ? "All spans satisfy BS 8110 requirements for flexure, shear and serviceability."
                : "One or more checks failed. Review the detailed span results below."
            }
            actions={
              <span className={`text-[11px] leading-snug ${text.helper}`}>
                To export this report, use your browser&apos;s Print → Save as PDF.
              </span>
            }
          />

          {/* Detailed span cards */}
          <div className="space-y-4 sm:space-y-6">
            {spans.map((span, idx) => (
              <Section
                key={idx}
                title={`Span ${idx + 1} · ${Number(span.span_length ?? 0).toFixed(2)} m`}
                icon={<Ruler size={18} aria-hidden="true" />}
                actions={
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge label="Flexure" status={span.design_checks?.moment_capacity_ok} />
                    <StatusBadge label="Shear" status={span.design_checks?.shear_capacity_ok} />
                    <StatusBadge label="Deflection" status={span.design_checks?.deflection_ok} />
                    <StatusBadge label="Cover" status={span.design_checks?.cover_ok} />
                  </div>
                }
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                  {/* 1. Main Reinforcement (Sagging) */}
                  <div className="space-y-2">
                    <h4 className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${text.helper}`}>
                      <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                      Bottom reinforcement (sagging)
                    </h4>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-800/30 dark:bg-blue-900/20 sm:p-4">
                      <p className={`mb-1 text-xs ${text.helper}`}>
                        Design moment:{" "}
                        <span className={`font-bold ${text.title}`}>
                          {Number(span.sagging_moment ?? 0).toFixed(1)} kNm
                        </span>
                      </p>

                      <p className="text-xl font-black text-blue-700 dark:text-blue-300 sm:text-2xl">
                        {span.sagging_bars_count} T{span.sagging_bars_diameter}
                      </p>
                      <p className="mt-1 text-[11px] text-blue-700/80 dark:text-blue-300/80">
                        Provided: {Number(span.sagging_As_provided ?? 0).toFixed(0)} mm² ·
                        Required: {Number(span.sagging_As_required ?? 0).toFixed(0)} mm²
                      </p>

                      {/* Compression (If Doubly Reinforced) */}
                      {span.sagging_compression_needed && (
                        <div className="mt-2 border-t border-blue-200 pt-2 dark:border-blue-800/50">
                          <p className="text-[11px] font-bold text-blue-800 dark:text-blue-200">
                            Compression steel (top)
                          </p>
                          <p className="text-base font-bold text-blue-800 dark:text-blue-200">
                            {span.sagging_compression_bars_count} T
                            {span.sagging_compression_bars_diameter}
                          </p>
                          <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                            Provided: {Number(span.sagging_compression_As_provided ?? 0).toFixed(0)} mm²
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Top Reinforcement (Hogging) */}
                  <div className="space-y-2">
                    <h4 className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${text.helper}`}>
                      <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
                      Top reinforcement (supports)
                    </h4>
                    <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 dark:border-orange-800/30 dark:bg-orange-900/20 sm:p-4">
                      <p className={`mb-1 text-xs ${text.helper}`}>
                        Design moment:{" "}
                        <span className={`font-bold ${text.title}`}>
                          {Math.abs(span.hogging_moment_left || 0).toFixed(1)} kNm
                        </span>
                      </p>

                      <p className="text-xl font-black text-orange-700 dark:text-orange-300 sm:text-2xl">
                        {span.hogging_bars_count} T{span.hogging_bars_diameter}
                      </p>
                      <p className="mt-1 text-[11px] text-orange-700/80 dark:text-orange-300/80">
                        Provided: {Number(span.hogging_As_provided ?? 0).toFixed(0)} mm² ·
                        Required: {Number(span.hogging_As_required_left ?? 0).toFixed(0)} mm²
                      </p>

                      {/* Compression (If Doubly Reinforced) */}
                      {span.hogging_compression_needed && (
                        <div className="mt-2 border-t border-orange-200 pt-2 dark:border-orange-800/50">
                          <p className="text-[11px] font-bold text-orange-800 dark:text-orange-200">
                            Compression steel (bottom)
                          </p>
                          <p className="text-base font-bold text-orange-800 dark:text-orange-200">
                            {span.hogging_compression_bars_count} T
                            {span.hogging_compression_bars_diameter}
                          </p>
                          <p className="text-[11px] text-orange-700/80 dark:text-orange-300/80">
                            Provided: {Number(span.hogging_compression_As_provided ?? 0).toFixed(0)} mm²
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Shear Reinforcement */}
                  <div className="space-y-2">
                    <h4 className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${text.helper}`}>
                      <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden="true" />
                      Shear links
                    </h4>
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 dark:border-purple-800/30 dark:bg-purple-900/20 sm:p-4">
                      <p className={`mb-1 text-xs ${text.helper}`}>
                        Design shear:{" "}
                        <span className={`font-bold ${text.title}`}>
                          {Number(span.shear_max ?? 0).toFixed(1)} kN
                        </span>
                      </p>
                      <p className="text-xl font-black text-purple-700 dark:text-purple-300 sm:text-2xl">
                        H{span.shear_links_diameter} @ {span.shear_links_spacing}
                      </p>
                      <p className="mt-1 text-[11px] text-purple-700/80 dark:text-purple-300/80">
                        {span.shear_link_legs} legs · spacing in mm
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warnings & Checks Section */}
                {span.design_checks?.warnings?.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/30 dark:bg-amber-900/10 sm:p-4">
                    <h4 className="mb-1 flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <Info className="h-4 w-4" aria-hidden="true" /> Design notes &amp; warnings
                    </h4>
                    <ul className="list-inside list-disc space-y-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                      {span.design_checks.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!span.design_checks?.deflection_ok && (
                  <p className="mt-2 text-xs font-bold text-red-700 dark:text-red-300">
                    Deflection check failed: actual L/d{" "}
                    {Number(span.design_checks?.actual_L_d ?? 0).toFixed(1)} &gt; allowable{" "}
                    {Number(span.design_checks?.allowable_L_d ?? 0).toFixed(1)}
                  </p>
                )}

                <TechnicalDetails summary="Span input echo" className="mt-3">
                  <dl className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
                    <div>
                      <dt className="opacity-70">Span length</dt>
                      <dd>{span.span_length} m</dd>
                    </div>
                    <div>
                      <dt className="opacity-70">As,req (sag)</dt>
                      <dd>{span.sagging_As_required} mm²</dd>
                    </div>
                    <div>
                      <dt className="opacity-70">As,req (hog, left)</dt>
                      <dd>{span.hogging_As_required_left} mm²</dd>
                    </div>
                    <div>
                      <dt className="opacity-70">Link legs</dt>
                      <dd>{span.shear_link_legs}</dd>
                    </div>
                  </dl>
                </TechnicalDetails>
              </Section>
            ))}
          </div>
        </div>
      )}

      {/* 2D Beam Drawer Modal */}
      <ViewerModal
        open={show2DDrawer}
        onClose={() => setShow2DDrawer(false)}
        title="2D detailing sections"
        subtitle="Cross-sections per span with main steel, compression steel and links"
        isDark={isDark}
        bodyClassName="p-3 sm:p-5"
      >
        <div className="space-y-6">
          {spans.map((span, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-2 bg-gray-50 px-3 py-2 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
                <h4 className={`text-sm font-bold ${text.title}`}>
                  Span {idx + 1} ({span.span_length} m)
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    // Existing handoff contract: the CAD drawer consumes
                    // window.CAD_PENDING_MEMBER on mount. Unchanged.
                    const memberData = {
                      memberType: "beam",
                      config: get2DConfig(span, idx),
                      x: 0,
                      y: 0,
                    };
                    window.CAD_PENDING_MEMBER = memberData;
                    navigate("/drawing");
                  }}
                  className={`${action.base} ${action.primary} min-h-[36px] px-3 py-1.5 text-xs`}
                >
                  Send to CAD
                </button>
              </div>
              <div className="overflow-x-auto p-2">
                <BeamColumnDrawer config={get2DConfig(span, idx)} section="both" />
              </div>
            </div>
          ))}
        </div>
      </ViewerModal>

      {/* 3D Viewer Modal */}
      <ViewerModal
        open={show3DViewer}
        onClose={() => setShow3DViewer(false)}
        title="3D reinforcement model"
        subtitle="Drag to orbit · scroll or pinch to zoom"
        isDark={isDark}
        bodyClassName="relative bg-gray-100 dark:bg-slate-950"
        footer={
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" /> Main
              steel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" /> Links
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-600" aria-hidden="true" /> Supports
            </span>
          </div>
        }
      >
        <div className="h-full min-h-[45vh] w-full">
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
      </ViewerModal>
    </WorkspacePage>
  );
};

export default RCBeamDesigner;
