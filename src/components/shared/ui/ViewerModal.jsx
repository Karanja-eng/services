import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { action, surface, text } from "./tokens";

/**
 * ViewerModal — the single container for 2D/3D canvas viewers (Konva sections,
 * React Three Fiber models, drawing previews, document previews).
 *
 * Behaviour:
 * - Full-screen sheet on phones (a desktop dialog cannot be "compressed"), a
 *   centred dialog from `sm` upwards.
 * - The canvas region is `flex-1 min-h-0` so R3F/Konva resize correctly and the
 *   header/footer never overlap the drawing.
 * - Escape closes, focus moves into the dialog, background scroll is locked, and
 *   the close control meets the 44 px touch-target rule.
 *
 * This component only *presents* a viewer; the engine (R3F / Konva / MLightCAD /
 * That Open / web-ifc) is always supplied by the caller as children.
 */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ViewerModal = ({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  footer,
  isDark = false,
  className = "",
  bodyClassName = "",
  closeLabel = "Close viewer",
}) => {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // Lock background scrolling without jumping the page.
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const focusTimer = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector(FOCUSABLE);
      target?.focus?.();
    }, 30);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      window.clearTimeout(focusTimer);
      const restore = previouslyFocused.current;
      if (restore && typeof restore.focus === "function") restore.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4 ${
        isDark ? "dark" : ""
      }`}
      onMouseDown={(event) => {
        // Click-outside closes only on the backdrop itself (not on drag inside).
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Viewer"}
        className={`flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-[92vh] sm:max-w-6xl sm:rounded-2xl ${className}`}
      >
        {/* Header: compact on phones, one row on desktop. */}
        <div
          className={`flex shrink-0 flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 ${surface.stickyBar}`}
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className={`truncate text-sm font-bold sm:text-base ${text.title}`}>
                {title}
              </h2>
              {subtitle && (
                <p className={`mt-0.5 truncate text-[11px] sm:text-xs ${text.subtitle}`}>
                  {subtitle}
                </p>
              )}
            </div>
            {/* Close stays visible in the header row on phones. */}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className={`${action.icon} -mr-1 shrink-0 sm:hidden`}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className={`${action.icon} hidden shrink-0 sm:inline-flex`}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Viewer surface — min-h-0 is required for canvas resizing. */}
        <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>{children}</div>

        {footer && (
          <div
            className={`shrink-0 border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 ${surface.stickyBar}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewerModal;
