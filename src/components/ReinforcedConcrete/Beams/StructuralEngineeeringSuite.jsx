import React, { useState } from "react";
import {
  Calculator,
  GitBranch,
  ArrowRight,
  ChevronLeft,
  Layout,
  Layers,
  Box,
  Ruler,
  Shield,
} from "lucide-react";
import RCBeamDesigner from "./RCBeamDesigner";
import MomentDistributionCalculator from "./distribution";
import EnhancedThreeMomentCalculator from "./Three";
import BSCoefficientsCalculator from "./BSCoefficientsCalculator";
import EurocodeBeamDesign from "./Eurocode_beam";
import DesignCodeToggle from "../../shared/primitives/DesignCodeToggle";
import {
  WorkspacePage,
  PageHeader,
  Section,
  MetaChip,
  NumberField,
  SelectField,
  SegmentedField,
  action,
  text,
  surface,
  layout,
} from "../../shared/ui";

/**
 * StructuralEngineeringSuite
 *
 * Workflow:
 * 1. Design Parameters (Dimensions, Materials, BS 8110 Settings)
 * 2. Beam Configuration (Single, Continuous, Cantilever)
 * 3. Analysis Method (if Continuous)
 * 4. Analysis & Design Results
 *
 * UI NOTE (UI cleanup):
 * The design-code selector, fields, section cards and action layout now come
 * from the shared UI kit (`src/components/shared/ui`). The engineering contract
 * is untouched:
 *   - `activeCode` values ("BS8110" / "Eurocode") are forwarded verbatim.
 *   - `beamParams` keeps the exact same keys, default values and types.
 *   - Number fields keep the original `parseInt` parsing, including the
 *     select for `fcu` that can legitimately hold the string "C30/37".
 *   - Calculation components receive the same `initialParams` /
 *     `onAnalysisComplete` props.
 */
const StructuralEngineeringSuite = ({ isDark = false }) => {
  const [activeCode, setActiveCode] = useState("BS8110"); // new state for design code
  const [step, setStep] = useState("params"); // params, type, method, calculator, design
  const [beamType, setBeamType] = useState(null);
  const [analysisMethod, setAnalysisMethod] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);

  // Design Parameters State (Global for the suite)
  const [beamParams, setBeamParams] = useState({
    beam_type: "Rectangular", // Section type
    fcu: 30,
    fy: 460,
    width: 300,
    depth: 500,
    cover: 25,
    web_width: 300,
    flange_width: 1000,
    flange_thickness: 150,
    exposure_condition: "Moderate",
    fire_resistance_period: "1 hour",
    permanent_load: 5.0,
    imposed_load: 10.0,
  });

  const beamConfigurations = [
    {
      id: "single",
      name: "Single Span",
      description: "Simply supported beam with a single span",
      icon: <Box className="h-7 w-7" />,
    },
    {
      id: "cantilever",
      name: "Cantilevered",
      description: "Beam fixed at one end and free at the other",
      icon: <Layers className="h-7 w-7" />,
    },
    {
      id: "continuous",
      name: "Continuous",
      description: "Beam spanning over multiple supports",
      icon: <GitBranch className="h-7 w-7" />,
    },
  ];

  const continuousMethods = [
    {
      id: "three-moment",
      name: "Three-Moment Theorem",
      description: "Classical method for continuous beam analysis",
      icon: <Calculator className="h-7 w-7" />,
      component: EnhancedThreeMomentCalculator,
    },
    {
      id: "moment-distribution",
      name: "Moment Distribution",
      description: "Hardy Cross iterative method for frames and beams",
      icon: <GitBranch className="h-7 w-7" />,
      component: MomentDistributionCalculator,
    },
    {
      id: "bs-coefficients",
      name: "BS 8110 Coefficients",
      description: "Simplified design using Table 3.5 coefficients",
      icon: <Layout className="h-7 w-7" />,
      component: BSCoefficientsCalculator,
    },
  ];

  const handleTypeSelect = (type) => {
    setBeamType(type);
    if (type === "continuous") {
      setStep("method");
    } else {
      setAnalysisMethod("three-moment"); // Default for single/cantilever (can be overridden later if needed)
      setStep("calculator");
    }
  };

  const handleMethodSelect = (method) => {
    setAnalysisMethod(method);
    setStep("calculator");
  };

  // Helper to map UI beam type to Backend Support Condition
  const getSupportCondition = (type) => {
    switch (type) {
      case "single":
        return "Simply Supported";
      case "cantilever":
        return "Cantilever";
      case "continuous":
        return "Continuous";
      default:
        return "Continuous";
    }
  };

  const currentDesignParams = {
    ...beamParams,
    support_condition: getSupportCondition(beamType),
  };

  /* ------------------------------------------------------- step 1: parameters */
  const renderDesignParameters = () => (
    <WorkspacePage width="default">
      <PageHeader
        title="RC Beam Designer"
        subtitle={
          activeCode === "Eurocode"
            ? "Eurocode 2 (EN 1992-1-1) compliant design"
            : "BS 8110-1:1997 compliant design suite"
        }
        icon={<Ruler size={22} aria-hidden="true" />}
        meta={
          <>
            <MetaChip tone="info">Multi-span analysis</MetaChip>
            <MetaChip>Flexure · Shear · Deflection</MetaChip>
          </>
        }
        actions={
          <DesignCodeToggle
            value={activeCode}
            onChange={setActiveCode}
            isDark={isDark}
            ariaLabel="Design standard"
            options={[
              { id: "BS8110", label: "BS 8110" },
              { id: "Eurocode", label: "Eurocode 2" },
            ]}
          />
        }
      />

      {activeCode === "Eurocode" ? (
        <EurocodeBeamDesign />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Section 1: Beam Section Type */}
          <Section
            title="Section configuration"
            description="Choose the cross-section shape before entering geometry."
            icon={<Layout size={18} aria-hidden="true" />}
          >
            <SegmentedField
              label="Section type"
              value={beamParams.beam_type}
              onChange={(value) => setBeamParams({ ...beamParams, beam_type: value })}
              options={[
                { value: "Rectangular", label: "Rectangular" },
                { value: "T-Beam", label: "T-Beam" },
                { value: "L-Beam", label: "L-Beam" },
              ]}
            />
          </Section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            {/* Materials */}
            <Section
              title="Materials"
              description="Characteristic strengths used by the design checks."
              icon={<Layers size={18} aria-hidden="true" />}
            >
              <div className={layout.formGrid}>
                <SelectField
                  label="Concrete (fcu)"
                  unit="N/mm²"
                  value={beamParams.fcu}
                  onChange={(value) =>
                    setBeamParams({
                      ...beamParams,
                      // The original parser is preserved: numeric cube strengths are
                      // stored as integers, the Eurocode option stays a string.
                      fcu: value === "C30/37" ? "C30/37" : parseInt(value, 10),
                    })
                  }
                  options={[
                    ...[20, 25, 30, 35, 40, 45, 50].map((f) => ({
                      value: f,
                      label: `C${f} (${f} N/mm²)`,
                    })),
                    { value: "C30/37", label: "C30/37 (Eurocode)" },
                  ]}
                />
                <SelectField
                  label="Steel (fy)"
                  unit="N/mm²"
                  value={beamParams.fy}
                  onChange={(value) =>
                    setBeamParams({ ...beamParams, fy: parseInt(value, 10) })
                  }
                  options={[
                    { value: 250, label: "Grade 250" },
                    { value: 460, label: "Grade 460" },
                  ]}
                />
                <SelectField
                  label="Exposure condition"
                  value={beamParams.exposure_condition}
                  onChange={(value) =>
                    setBeamParams({ ...beamParams, exposure_condition: value })
                  }
                  options={["Mild", "Moderate", "Severe", "Very Severe", "Extreme"]}
                />
                <SelectField
                  label="Fire resistance"
                  value={beamParams.fire_resistance_period}
                  onChange={(value) =>
                    setBeamParams({ ...beamParams, fire_resistance_period: value })
                  }
                  options={["30 mins", "1 hour", "1.5 hours", "2 hours", "3 hours", "4 hours"]}
                />
              </div>
            </Section>

            {/* Dimensions */}
            <Section
              title="Dimensions"
              description="All section dimensions are in millimetres."
              icon={<Ruler size={18} aria-hidden="true" />}
              tone="muted"
            >
              {beamParams.beam_type === "Rectangular" ? (
                <div className={layout.formGrid}>
                  <NumberField
                    label="Width (b)"
                    unit="mm"
                    min={100}
                    step="10"
                    value={beamParams.width}
                    onChange={(value) =>
                      setBeamParams({ ...beamParams, width: parseInt(value, 10) })
                    }
                  />
                  <NumberField
                    label="Depth (h)"
                    unit="mm"
                    min={100}
                    step="10"
                    value={beamParams.depth}
                    onChange={(value) =>
                      setBeamParams({ ...beamParams, depth: parseInt(value, 10) })
                    }
                  />
                  <div className="sm:col-span-2">
                    <NumberField
                      label="Nominal cover (c)"
                      unit="mm"
                      min={15}
                      step="5"
                      hint="Clear cover to the outermost reinforcement."
                      value={beamParams.cover}
                      onChange={(value) =>
                        setBeamParams({ ...beamParams, cover: parseInt(value, 10) })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className={layout.formGrid}>
                  <NumberField
                    label="Web width (bw)"
                    unit="mm"
                    min={100}
                    step="10"
                    value={beamParams.web_width}
                    onChange={(value) =>
                      setBeamParams({ ...beamParams, web_width: parseInt(value, 10) })
                    }
                  />
                  <NumberField
                    label="Total depth (h)"
                    unit="mm"
                    min={100}
                    step="10"
                    value={beamParams.depth}
                    onChange={(value) =>
                      setBeamParams({ ...beamParams, depth: parseInt(value, 10) })
                    }
                  />
                  <NumberField
                    label="Flange width (bf)"
                    unit="mm"
                    min={0}
                    step="10"
                    value={beamParams.flange_width}
                    onChange={(value) =>
                      setBeamParams({ ...beamParams, flange_width: parseInt(value, 10) })
                    }
                  />
                  <NumberField
                    label="Flange thickness (hf)"
                    unit="mm"
                    min={0}
                    step="10"
                    value={beamParams.flange_thickness}
                    onChange={(value) =>
                      setBeamParams({ ...beamParams, flange_thickness: parseInt(value, 10) })
                    }
                  />
                  <div className="sm:col-span-2">
                    <NumberField
                      label="Nominal cover (c)"
                      unit="mm"
                      min={15}
                      step="5"
                      value={beamParams.cover}
                      onChange={(value) =>
                        setBeamParams({ ...beamParams, cover: parseInt(value, 10) })
                      }
                    />
                  </div>
                </div>
              )}
              <p className={`mt-3 text-[11px] leading-relaxed ${text.helper}`}>
                These parameters are forwarded unchanged to the analysis method and the
                BS 8110 design endpoint.
              </p>
            </Section>
          </div>

          <button
            type="button"
            onClick={() => setStep("type")}
            className={`${action.base} ${action.primary} w-full text-base`}
          >
            Continue to analysis configuration
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </WorkspacePage>
  );

  /* ----------------------------------------------------- step 2: support type */
  const renderTypeSelection = () => (
    <WorkspacePage width="default">
      <PageHeader
        title="Structural configuration"
        subtitle="How is this beam supported?"
        icon={<Shield size={22} aria-hidden="true" />}
        onBack={() => setStep("params")}
        backLabel="Edit parameters"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
        {beamConfigurations.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => handleTypeSelect(type.id)}
            className="group flex min-h-[44px] flex-col items-start rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
          >
            <span className="mb-3 rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
              {type.icon}
            </span>
            <span className={`text-lg font-bold ${text.title}`}>{type.name}</span>
            <span className={`mt-1 text-xs leading-relaxed ${text.subtitle}`}>
              {type.description}
            </span>
          </button>
        ))}
      </div>
    </WorkspacePage>
  );

  /* ------------------------------------------------------ step 3: method pick */
  const renderMethodSelection = () => (
    <WorkspacePage width="default">
      <PageHeader
        title="Continuous beam analysis"
        subtitle="Select the analysis method for the continuous spans."
        icon={<GitBranch size={22} aria-hidden="true" />}
        onBack={() => setStep("type")}
        backLabel="Back to support type"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
        {continuousMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => handleMethodSelect(method.id)}
            className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
          >
            <span className="mb-3 block text-blue-600 dark:text-blue-300">{method.icon}</span>
            <span className={`block text-base font-bold ${text.title}`}>{method.name}</span>
            <span className={`mt-1 block text-xs leading-relaxed ${text.subtitle}`}>
              {method.description}
            </span>
          </button>
        ))}
      </div>
    </WorkspacePage>
  );

  const SelectedCalculator =
    continuousMethods.find((m) => m.id === analysisMethod)?.component ||
    EnhancedThreeMomentCalculator;

  return (
    <div className={`min-h-full ${isDark ? "bg-slate-900" : "bg-gray-50"}`}>
      {step === "calculator" && (
        <div
          className={`sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 ${surface.stickyBar} sm:px-5`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setStep("params")}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-blue-50 px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200"
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Edit params
            </button>
            <h2 className={`truncate text-xs font-bold sm:text-sm ${text.title}`}>
              Analysis mode
            </h2>
          </div>
          {analysisResults && (
            <button
              type="button"
              onClick={() => setStep("design")}
              className={`${action.base} ${action.success} min-h-[36px] px-3 py-1.5 text-xs`}
            >
              View design report
            </button>
          )}
        </div>
      )}

      <div className="py-4 sm:py-6">
        {step === "params" && renderDesignParameters()}
        {step === "type" && renderTypeSelection()}
        {step === "method" && renderMethodSelection()}

        {step === "calculator" && (
          <div className="space-y-5">
            <SelectedCalculator
              key={analysisMethod}
              isDark={isDark}
              beamType={beamType}
              initialParams={currentDesignParams} // Pass full params
              onAnalysisComplete={(results) => {
                setAnalysisResults(results);
              }}
            />

            {analysisResults && (
              <div className="mx-auto max-w-4xl px-3 sm:px-4">
                <div className="flex flex-col gap-3 rounded-2xl border-l-4 border-green-500 bg-white p-4 shadow-sm dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-green-700 dark:text-green-400">
                      Analysis successful
                    </h3>
                    <p className={`text-xs ${text.subtitle}`}>
                      Moments and shears have been calculated.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("design")}
                    className={`${action.base} ${action.success}`}
                  >
                    Proceed to detailing
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "design" && analysisResults && (
          <RCBeamDesigner
            analysisResults={analysisResults}
            designParams={currentDesignParams} // Pass full params including support_condition
            analysisMethod={analysisMethod}
            isDark={isDark}
            onBack={() => setStep("calculator")} // Allow going back
          />
        )}
      </div>
    </div>
  );
};

export default StructuralEngineeringSuite;
