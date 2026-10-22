/**
 * Fundi Studio shared UI kit — public surface.
 *
 * Layer 1 (this directory): presentation-only primitives and layout.
 * Layer 2 (`shared/engineering`): domain compositions built from these.
 *
 * Import from here rather than reaching into individual files, so future token
 * or accessibility changes land in one place:
 *
 *   import { PageHeader, Section, NumberField } from "../../shared/ui";
 */
export * from "./tokens";
export * from "./PageLayout";
export * from "./Fields";
export * from "./Status";
export * from "./Feedback";
export * from "./TableRegion";
export { default as ViewerModal } from "./ViewerModal";
