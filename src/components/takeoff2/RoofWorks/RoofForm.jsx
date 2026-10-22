import React from "react";
import { Settings, Ruler, Calculator, Layers } from "lucide-react";
import {
  Section,
  NumberField,
  SelectField,
  CheckboxField,
  ActionBar,
  action,
  layout,
} from "../../shared/ui";

/**
 * RoofForm — initial geometry/material inputs for the roof takeoff.
 *
 * UI cleanup only:
 * - Fields use the shared engineering primitives (labelled, unit-bearing,
 *   single column on phones, two columns from `sm`).
 * - The previous "Save" / "Import" buttons were placeholders with no handlers.
 *   They were removed rather than left looking functional; the takeoff is
 *   produced by `onCalculate` and then edited in the taking-off sheet.
 * - `onChange(key, value)` and every config key/parse (`parseFloat` /
 *   `parseInt`) are unchanged, so the request payload to
 *   `/roof_router/api/generate-takeoff` is byte-for-byte the same.
 */
export default function RoofForm({ config, onChange, onCalculate }) {
  const updateConfig = (key, value) => {
    onChange(key, value);
  };

  const isBrokenPitch = config.roofType === "gambrel" || config.roofType === "mansard";

  return (
    <div className="space-y-4 sm:space-y-5">
      <Section
        title="Roof type and dimensions"
        description="Geometry drives the rafter lengths, covering area and girth calculations."
        icon={<Ruler size={18} aria-hidden="true" />}
      >
        <div className={layout.formGrid}>
          <SelectField
            label="Roof type"
            value={config.roofType}
            onChange={(value) => updateConfig("roofType", value)}
            options={[
              { value: "gable", label: "Gable roof" },
              { value: "hipped", label: "Hipped roof" },
              { value: "gambrel", label: "Gambrel roof" },
              { value: "lean-to", label: "Lean-to roof" },
              { value: "mansard", label: "Mansard roof" },
            ]}
          />
          <div className="hidden sm:block" aria-hidden="true" />

          <NumberField
            label="Building length"
            unit="m"
            step="0.1"
            min={0}
            value={config.buildingLength}
            onChange={(value) => updateConfig("buildingLength", parseFloat(value))}
          />
          <NumberField
            label="Building width"
            unit="m"
            step="0.1"
            min={0}
            value={config.buildingWidth}
            onChange={(value) => updateConfig("buildingWidth", parseFloat(value))}
          />
          <NumberField
            label="Wall thickness"
            unit="m"
            step="0.05"
            min={0}
            value={config.wallThickness}
            onChange={(value) => updateConfig("wallThickness", parseFloat(value))}
          />
          <NumberField
            label="Eaves overhang"
            unit="m"
            step="0.1"
            min={0}
            value={config.overhang}
            onChange={(value) => updateConfig("overhang", parseFloat(value))}
          />
        </div>
      </Section>

      <Section
        title="Pitch"
        description="Pitch angles are measured from the horizontal."
        icon={<Settings size={18} aria-hidden="true" />}
        tone="muted"
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label
                htmlFor="roof-pitch-1"
                className="text-xs font-semibold text-gray-700 dark:text-slate-200"
              >
                Lower pitch angle
              </label>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                {config.pitchAngle}°
              </span>
            </div>
            <input
              id="roof-pitch-1"
              type="range"
              min="5"
              max="80"
              value={config.pitchAngle}
              onChange={(e) => updateConfig("pitchAngle", parseInt(e.target.value, 10))}
              className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-transparent accent-blue-600"
              aria-valuetext={`${config.pitchAngle} degrees`}
            />
          </div>

          {isBrokenPitch && (
            <>
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="roof-pitch-2"
                    className="text-xs font-semibold text-gray-700 dark:text-slate-200"
                  >
                    Upper pitch angle
                  </label>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                    {config.pitchAngle2}°
                  </span>
                </div>
                <input
                  id="roof-pitch-2"
                  type="range"
                  min="5"
                  max="45"
                  value={config.pitchAngle2}
                  onChange={(e) => updateConfig("pitchAngle2", parseInt(e.target.value, 10))}
                  className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-transparent accent-blue-600"
                  aria-valuetext={`${config.pitchAngle2} degrees`}
                />
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="roof-break-ratio"
                    className="text-xs font-semibold text-gray-700 dark:text-slate-200"
                  >
                    Break ratio
                  </label>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                    {config.breakRatio}
                  </span>
                </div>
                <input
                  id="roof-break-ratio"
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={config.breakRatio}
                  onChange={(e) => updateConfig("breakRatio", parseFloat(e.target.value))}
                  className="h-11 w-full cursor-pointer appearance-none rounded-lg bg-transparent accent-blue-600"
                  aria-valuetext={`${config.breakRatio}`}
                />
              </div>
            </>
          )}
        </div>
      </Section>

      <Section
        title="Framing and covering"
        description="Spacings and materials feed the SMM7 takeoff sections."
        icon={<Layers size={18} aria-hidden="true" />}
      >
        <div className={layout.formGrid}>
          <NumberField
            label="Truss spacing"
            unit="m"
            step="0.1"
            min={0}
            value={config.trussSpacing}
            onChange={(value) => updateConfig("trussSpacing", parseFloat(value))}
          />
          <NumberField
            label="Rafter spacing"
            unit="m"
            step="0.1"
            min={0}
            value={config.rafterSpacing}
            onChange={(value) => updateConfig("rafterSpacing", parseFloat(value))}
          />
          <SelectField
            label="Structure material"
            value={config.material}
            onChange={(value) => updateConfig("material", value)}
            options={[
              { value: "timber", label: "Timber" },
              { value: "steel", label: "Steel" },
            ]}
          />
          <SelectField
            label="Roof covering"
            value={config.covering}
            onChange={(value) => updateConfig("covering", value)}
            options={[
              { value: "none", label: "None" },
              { value: "tiles", label: "Clay tiles" },
              { value: "acSheets", label: "A.C. sheets" },
              { value: "giSheets", label: "G.I. sheets" },
              { value: "slate", label: "Slate" },
              { value: "thatch", label: "Thatch" },
            ]}
          />
          <div className="sm:col-span-2">
            <CheckboxField
              label="Include rainwater goods"
              hint="Gutters and downpipes are added to the takeoff when enabled."
              checked={config.includeRainwaterGoods}
              onChange={(checked) => updateConfig("includeRainwaterGoods", checked)}
            />
          </div>
        </div>
      </Section>

      <ActionBar hint="Generates a takeoff you can edit in the taking-off sheet.">
        <button type="button" onClick={onCalculate} className={`${action.base} ${action.primary}`}>
          <Calculator size={16} aria-hidden="true" />
          Calculate takeoff
        </button>
      </ActionBar>
    </div>
  );
}
