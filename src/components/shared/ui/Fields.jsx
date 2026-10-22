import React, { forwardRef, useId } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { control, text } from "./tokens";

/**
 * Shared engineering form primitives.
 *
 * Design constraints (see docs/FUNDI_STUDIO_UI_CLEANUP_PLAN.md):
 * - Presentation only. `onChange` always receives the raw `event.target.value`
 *   string, so the owning workflow keeps its exact existing parsing
 *   (`parseInt`, `parseFloat`, string state, ...). No silent coercion happens
 *   inside these components — engineering values are never rewritten by the UI.
 * - Labels are always associated with their control (`htmlFor` / `id`).
 * - Units are always visible, never inferred.
 * - Errors and warnings are rendered next to the field and are announced via
 *   `aria-describedby` + `aria-invalid`, and never rely on colour alone.
 */

const describedBy = (...ids) => {
  const value = ids.filter(Boolean).join(" ");
  return value.length ? value : undefined;
};

/* --------------------------------------------------------------- field shell */

/**
 * EngineeringField — label + unit + control + helper/validation message.
 *
 * @param {object} props
 * @param {string} props.label            Visible field label (required).
 * @param {string} [props.unit]           Engineering unit shown beside the label.
 * @param {string} [props.id]             Control id. Generated when omitted.
 * @param {React.ReactNode} props.children The control itself.
 * @param {string} [props.hint]           Helper text shown under the control.
 * @param {string} [props.error]          Validation message (field is invalid).
 * @param {string} [props.warning]        Code/limit warning (field is still valid).
 * @param {boolean} [props.required]      Marks the field as required.
 * @param {string} [props.className]      Extra classes for the wrapper.
 * @param {string} [props.labelClassName]
 */
export const EngineeringField = ({
  label,
  unit,
  id,
  children,
  hint,
  error,
  warning,
  required = false,
  className = "",
  labelClassName = "",
  ...rest
}) => {
  const generatedId = useId();
  const fieldId = id || `f-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : null;
  const errorId = error ? `${fieldId}-error` : null;
  const warningId = warning ? `${fieldId}-warn` : null;

  // Clone the child to wire accessibility attributes without duplicating markup.
  const control_ = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id || fieldId,
        "aria-describedby":
          children.props["aria-describedby"] ||
          describedBy(hintId, errorId, warningId),
        "aria-invalid": error ? "true" : children.props["aria-invalid"],
        required: children.props.required ?? (required || undefined),
      })
    : children;

  return (
    <div className={`min-w-0 ${className}`} {...rest}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 mb-1.5">
        <label
          htmlFor={fieldId}
          className={`text-xs font-semibold leading-snug ${text.label} ${labelClassName}`}
        >
          {label}
          {required && (
            <span className="text-red-600 dark:text-red-400 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {unit && (
          <span
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 ${text.unit} whitespace-nowrap`}
          >
            {unit}
          </span>
        )}
      </div>

      {control_}

      {hint && !error && (
        <p id={hintId} className={`mt-1 text-[11px] leading-snug ${text.helper}`}>
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          className="mt-1 flex items-start gap-1 text-[11px] font-medium leading-snug text-red-700 dark:text-red-300"
        >
          <AlertCircle size={13} className="mt-[1px] shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {warning && !error && (
        <p
          id={warningId}
          className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle size={13} className="mt-[1px] shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </p>
      )}
    </div>
  );
};

/* -------------------------------------------------------------- number input */

/**
 * NumberInput — numeric control that keeps the owner's parsing contract.
 * `onChange` receives the raw string value. An empty input yields "".
 */
export const NumberInput = forwardRef(function NumberInput(
  {
    value,
    onChange,
    step = "any",
    min,
    max,
    placeholder,
    disabled = false,
    invalid = false,
    className = "",
    inputMode = "decimal",
    id,
    ...rest
  },
  ref
) {
  return (
    <input
      ref={ref}
      id={id}
      type="number"
      inputMode={inputMode}
      step={step}
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value, e)}
      aria-invalid={invalid || undefined}
      className={`${control.base} ${control.number} ${invalid ? control.invalid : ""} ${className}`}
      {...rest}
    />
  );
});

/**
 * NumberField — EngineeringField + NumberInput (the common case).
 * Props are forwarded; see both components for the contract.
 */
export const NumberField = ({
  label,
  unit,
  value,
  onChange,
  hint,
  error,
  warning,
  required,
  step = "any",
  min,
  max,
  placeholder,
  disabled,
  className,
  id,
  ...rest
}) => (
  <EngineeringField
    label={label}
    unit={unit}
    id={id}
    hint={hint}
    error={error}
    warning={warning}
    required={required}
    className={className}
  >
    <NumberInput
      value={value}
      onChange={onChange}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      invalid={Boolean(error)}
      {...rest}
    />
  </EngineeringField>
);

/* -------------------------------------------------------------- text inputs */

export const TextInput = forwardRef(function TextInput(
  { value, onChange, placeholder, disabled, invalid = false, className = "", id, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      id={id}
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value, e)}
      aria-invalid={invalid || undefined}
      className={`${control.base} ${invalid ? control.invalid : ""} ${className}`}
      {...rest}
    />
  );
});

export const TextField = ({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  placeholder,
  disabled,
  className,
  id,
  ...rest
}) => (
  <EngineeringField
    label={label}
    id={id}
    hint={hint}
    error={error}
    required={required}
    className={className}
  >
    <TextInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      invalid={Boolean(error)}
      {...rest}
    />
  </EngineeringField>
);

/* ------------------------------------------------------------------ selects */

export const SelectInput = forwardRef(function SelectInput(
  { value, onChange, disabled, invalid = false, className = "", children, id, ...rest },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value, e)}
        aria-invalid={invalid || undefined}
        className={`${control.base} ${control.select} ${invalid ? control.invalid : ""} ${className}`}
        {...rest}
      >
        {children}
      </select>
      {/* Chevron kept as a pointer-events-none glyph so the native hit area stays intact. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500 text-[10px]"
      >
        ▼
      </span>
    </div>
  );
});

/**
 * SelectField — options may be given as strings, numbers or
 * `{ value, label, disabled }` objects.
 */
export const SelectField = ({
  label,
  value,
  onChange,
  options = [],
  hint,
  error,
  warning,
  required,
  unit,
  placeholder,
  disabled,
  className,
  id,
}) => (
  <EngineeringField
    label={label}
    unit={unit}
    id={id}
    hint={hint}
    error={error}
    warning={warning}
    required={required}
    className={className}
  >
    <SelectInput value={value} onChange={onChange} disabled={disabled} invalid={Boolean(error)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt, i) => {
        const normalised =
          typeof opt === "object" && opt !== null
            ? opt
            : { value: opt, label: String(opt) };
        return (
          <option
            key={`${normalised.value}-${i}`}
            value={normalised.value}
            disabled={normalised.disabled}
          >
            {normalised.label}
          </option>
        );
      })}
    </SelectInput>
  </EngineeringField>
);

/* ------------------------------------------------------------------ toggles */

/**
 * CheckboxField — a labelled checkbox with a 44px tap row.
 */
export const CheckboxField = ({
  label,
  checked,
  onChange,
  hint,
  disabled = false,
  className = "",
  id,
}) => {
  const generatedId = useId();
  const fieldId = id || `cb-${generatedId}`;
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={fieldId}
        className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer select-none"
      >
        <input
          id={fieldId}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked, e)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
        />
        <span className={`text-sm ${text.label}`}>
          {label}
          {hint && (
            <span className={`block text-[11px] font-normal ${text.helper}`}>{hint}</span>
          )}
        </span>
      </label>
    </div>
  );
};

/**
 * SegmentedField — small inline choice group for 2–5 options.
 * For design standards prefer the richer shared `DesignCodeToggle`.
 */
export const SegmentedField = ({ label, value, onChange, options = [], className = "" }) => (
  <div className={`min-w-0 ${className}`}>
    {label && (
      <p className={`text-xs font-semibold mb-1.5 ${text.label}`}>{label}</p>
    )}
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-gray-100 dark:bg-slate-800"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange?.(opt.value)}
            className={`flex-1 min-w-[80px] min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isActive
                ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                : "text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

/* ----------------------------------------------------------- inline notices */

export const FieldHint = ({ children, tone = "info", className = "" }) => {
  const toneClass =
    tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "error"
      ? "text-red-700 dark:text-red-300"
      : text.helper;
  const Icon = tone === "warn" ? AlertTriangle : tone === "error" ? AlertCircle : Info;
  return (
    <p className={`flex items-start gap-1.5 text-[11px] leading-snug ${toneClass} ${className}`}>
      <Icon size={13} className="mt-[1px] shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
};

const fields = {
  EngineeringField,
  NumberInput,
  NumberField,
  TextInput,
  TextField,
  SelectInput,
  SelectField,
  CheckboxField,
  SegmentedField,
  FieldHint,
};

export default fields;
