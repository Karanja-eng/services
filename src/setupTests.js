/**
 * Jest setup (loaded automatically by react-scripts before each test file).
 *
 * Why this exists: `lucide-react` ships an ESM build that Jest cannot parse
 * without transforming `node_modules`. The shared UI primitives use icons purely
 * as decoration, so the suite replaces the icon module with a tiny SVG stub.
 * This keeps the focused component tests running with the existing test runner
 * and adds no dependency.
 */
jest.mock("lucide-react", () => {
  const React = require("react");
  const Icon = (props) => React.createElement("svg", { "data-testid": "icon", ...props });
  return new Proxy(
    {},
    {
      get: () => Icon,
      has: () => true,
    }
  );
});

// React 18+ requires this flag for `act()` outside of a test renderer.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
