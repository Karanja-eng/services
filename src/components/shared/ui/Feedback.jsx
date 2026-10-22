import React from "react";
import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { action, text } from "./tokens";

/**
 * Empty / loading / error states shared across engineering workflows.
 * Each state always shows a plain-language explanation, never a fake result.
 */

/**
 * EmptyState — shown before a tool has produced any output.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.actions]
 */
export const EmptyState = ({
  title = "Nothing to show yet",
  description,
  icon,
  actions,
  className = "",
  compact = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 text-center dark:border-slate-700 dark:bg-slate-900/40 ${
      compact ? "px-4 py-6" : "px-4 py-10 sm:py-14"
    } ${className}`}
  >
    <div className="mb-3 text-gray-400 dark:text-slate-500">
      {icon || <Inbox size={compact ? 24 : 32} aria-hidden="true" />}
    </div>
    <h3 className={`text-sm font-bold sm:text-base ${text.title}`}>{title}</h3>
    {description && (
      <p className={`mt-1 max-w-md text-xs leading-relaxed sm:text-sm ${text.subtitle}`}>
        {description}
      </p>
    )}
    {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
  </div>
);

/**
 * ErrorNotice — recoverable error with an optional retry.
 * The raw message is shown because engineers need the actual failure text.
 */
export const ErrorNotice = ({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
  className = "",
  tone = "error",
}) => {
  const palette =
    tone === "warn"
      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200";
  return (
    <div role="alert" className={`rounded-xl border p-3 sm:p-4 ${palette} ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {message && (
            <p className="mt-1 break-words text-xs leading-relaxed opacity-90">{message}</p>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`${action.base} ${action.secondary} shrink-0`}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * LoadingState — announced busy state for a calculation or fetch.
 */
export const LoadingState = ({ label = "Calculating…", detail, className = "" }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center gap-3 px-4 py-10 text-center ${className}`}
  >
    <Loader2 size={28} className="animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
    <p className={`text-sm font-semibold ${text.title}`}>{label}</p>
    {detail && <p className={`max-w-sm text-xs ${text.subtitle}`}>{detail}</p>}
  </div>
);

/**
 * InlineSpinner — for buttons and dense rows.
 */
export const InlineSpinner = ({ size = 14, className = "" }) => (
  <Loader2 size={size} className={`animate-spin ${className}`} aria-hidden="true" />
);

/**
 * SkeletonBlock — neutral placeholder while a heavy viewer boots.
 */
export const SkeletonBlock = ({ className = "h-32 w-full" }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800 ${className}`}
  />
);

const feedbackComponents = {
  EmptyState,
  ErrorNotice,
  LoadingState,
  InlineSpinner,
  SkeletonBlock,
};

export default feedbackComponents;
