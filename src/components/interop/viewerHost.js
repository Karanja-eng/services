// src/components/interop/viewerHost.js
//
// DOM wiring for third-party viewers (MLightCAD) that take ownership of the DOM
// inside the element they are given.
//
// Reused from the proven Fundi Pulse implementation
// (siteflow-mobile/migrated-web-app/src/cad/viewerHost.js). MLightCAD's
// simple-UI plugin moves every existing child of its `host` element into its own
// `.ml-ex-ui-dock-main` wrapper. If that host were a React-rendered element with
// React children, React would later call `removeChild` on a node the plugin has
// already reparented and throw:
//
//   NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be
//   removed is not a child of this node.
//
// Invariant enforced here: the plugin host is rendered EMPTY by React, and the
// canvas container the viewer drives is created imperatively, so React never
// owns the host's child list.

/** Inline styles for the imperatively created canvas container. */
export const VIEWER_CONTAINER_STYLE = {
  flex: '1 1 auto',
  minWidth: '0',
  minHeight: '0',
  overflow: 'hidden',
  position: 'relative',
};

/** Marker attribute so the container can be recognised in the DOM. */
export const VIEWER_CONTAINER_ATTR = 'data-fundi-cad-container';

/**
 * Create the canvas container for a viewer host and attach it to the host.
 *
 * The returned element is intentionally *not* part of React's tree: it is the
 * only node React is not tracking inside the host, so the plugin may reparent it
 * without breaking React's bookkeeping.
 *
 * @param {HTMLElement} hostEl - React-rendered, childless plugin host element.
 * @param {Document} [doc] - Document used to create the element (injectable).
 * @returns {HTMLElement} Container to pass to AcApDocManager.createInstance.
 */
export function createViewerContainer(hostEl, doc = hostEl.ownerDocument) {
  if (!hostEl) throw new Error('createViewerContainer requires a host element');

  const container = doc.createElement('div');
  Object.assign(container.style, VIEWER_CONTAINER_STYLE);
  container.setAttribute(VIEWER_CONTAINER_ATTR, 'true');
  hostEl.appendChild(container);
  return container;
}

export default createViewerContainer;
