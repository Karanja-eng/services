import React from "react";
import { NumberField, SelectField } from "../ui/Fields";
import { Section } from "../ui/PageLayout";
import { Building2, Layers } from "lucide-react";

/**
 * Layer 2 — reusable engineering form compositions.
 *
 * These are *compositions of Layer 1 primitives*, not universal form engines.
 * Each one owns a single, genuinely repeated concern:
 *
 *   StoreyGridFields   — storey/bay grid geometry shared by the regular framed
 *                        analysis and the tall-frame workflows.
 *   MaterialGradeFields— concrete class + steel grade selectors shared by the
 *                        member design modules.
 *
 * They are strictly controlled: the owner passes its existing state object and
 * receives a patch. Field names, value types (these workflows keep strings from
 * `event.target.value`) and parsing stay with the owner, so no engineering
 * contract moves into the shared layer.
 */

/**
 * Storey & bay grid geometry.
 *
 * @param {object} props
 * @param {object} props.value   Owner state, e.g. `{ floors, bays, storyHeight, bayWidth }`.
 * @param {(patch: object) => void} props.onChange Receives only the changed keys.
 * @param {string} [props.prefix] Field group label prefix for ids.
 * @param {boolean} [props.showLateralLoad=false] Include the lateral load field.
 * @param {string} [props.lateralLabel='Lateral load']
 * @param {string} [props.lateralUnit='kN']
 * @param {number} [props.columns=2]
 * @param {string} [props.note] Optional explanatory note rendered under the grid.
 */
export const StoreyGridFields = ({
  value = {},
  onChange,
  showLateralLoad = false,
  lateralLabel = "Lateral load",
  lateralUnit = "kN",
  columns = 2,
  note,
}) => {
  const patch = (key) => (v) => onChange?.({ [key]: v });

  return (
    <div className={columns === 1 ? "space-y-3" : "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"}>
      <NumberField
        label="Number of storeys"
        unit="no."
        min={1}
        step="1"
        inputMode="numeric"
        value={value.floors ?? ""}
        onChange={patch("floors")}
      />
      <NumberField
        label="Number of bays"
        unit="no."
        min={1}
        step="1"
        inputMode="numeric"
        value={value.bays ?? ""}
        onChange={patch("bays")}
      />
      <NumberField
        label="Storey height"
        unit="m"
        min={2}
        step="0.1"
        value={value.storyHeight ?? ""}
        onChange={patch("storyHeight")}
      />
      <NumberField
        label="Bay width"
        unit="m"
        min={1}
        step="0.1"
        value={value.bayWidth ?? ""}
        onChange={patch("bayWidth")}
      />
      {showLateralLoad && (
        <NumberField
          label={lateralLabel}
          unit={lateralUnit}
          step="1"
          value={value.lateralLoad ?? ""}
          onChange={patch("lateralLoad")}
        />
      )}
      {note && (
        <p className="text-[11px] leading-snug text-gray-500 dark:text-slate-400 sm:col-span-2">
          {note}
        </p>
      )}
    </div>
  );
};

/**
 * Concrete class + steel grade selectors.
 *
 * @param {object} props
 * @param {object} props.value
 * @param {(patch: object) => void} props.onChange
 * @param {Array<{value: string, label: string}>} props.concreteOptions
 * @param {Array<{value: string, label: string}>} props.steelOptions
 * @param {string} [props.concreteKey='concreteGrade']
 * @param {string} [props.steelKey='steelGrade']
 * @param {string} [props.concreteLabel='Concrete grade']
 * @param {string} [props.steelLabel='Reinforcement grade']
 */
export const MaterialGradeFields = ({
  value = {},
  onChange,
  concreteOptions = [],
  steelOptions = [],
  concreteKey = "concreteGrade",
  steelKey = "steelGrade",
  concreteLabel = "Concrete grade",
  steelLabel = "Reinforcement grade",
}) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
    <SelectField
      label={concreteLabel}
      value={value[concreteKey] ?? ""}
      onChange={(v) => onChange?.({ [concreteKey]: v })}
      options={concreteOptions}
    />
    <SelectField
      label={steelLabel}
      value={value[steelKey] ?? ""}
      onChange={(v) => onChange?.({ [steelKey]: v })}
      options={steelOptions}
    />
  </div>
);

/* ---------------------------------------------------- building category cards */

/**
 * BuildingScopeSelector — the Regular / Tall distinction shown once, at the top
 * of the framed-building workspace.
 *
 * This is a *navigation* aid inside one route, not a new workflow: the selected
 * scope only forwards the user to the existing BS framed modules. Tall-frame
 * lateral systems, wind/seismic and robustness ties are never removed or merged
 * into the regular-frame modules.
 */
export const BuildingScopeSelector = ({ value, onChange }) => {
  const options = [
    {
      id: "regular",
      title: "Regular framed building",
      description:
        "Low- to mid-rise moment frame. Gravity-governed with first-order lateral analysis.",
      icon: <Layers size={18} aria-hidden="true" />,
      modules: "Load combinations · Ties · Frame analysis · Member design",
    },
    {
      id: "tall",
      title: "Tall building",
      description:
        "High-rise behaviour: structural systems, wind/seismic actions, second-order sway and robustness ties.",
      icon: <Building2 size={18} aria-hidden="true" />,
      modules: "Structural systems · Computer modelling · Wind · Seismic · Ties",
    },
  ];

  return (
    <div role="group" aria-label="Building scope" className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(opt.id)}
            className={`flex min-h-[44px] items-start gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              active
                ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/25"
                : "border-gray-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800"
            }`}
          >
            <span
              className={`mt-0.5 shrink-0 ${
                active ? "text-blue-600 dark:text-blue-300" : "text-gray-400 dark:text-slate-500"
              }`}
            >
              {opt.icon}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-sm font-bold ${
                  active ? "text-blue-800 dark:text-blue-200" : "text-gray-800 dark:text-slate-100"
                }`}
              >
                {opt.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-gray-600 dark:text-slate-400">
                {opt.description}
              </span>
              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">
                {opt.modules}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * FrameGeometrySection — Section wrapper used by both scope workflows.
 */
export const FrameGeometrySection = ({ title = "Storey & bay grid", description, children }) => (
  <Section
    title={title}
    description={description}
    icon={<Layers size={18} aria-hidden="true" />}
  >
    {children}
  </Section>
);

const frameInputs = {
  StoreyGridFields,
  MaterialGradeFields,
  BuildingScopeSelector,
  FrameGeometrySection,
};

export default frameInputs;
