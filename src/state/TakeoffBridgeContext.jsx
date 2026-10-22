import React, { createContext, useContext, useMemo } from "react";
import {
  clearSourceBatch,
  countSourceBatch,
  publishSourceBatch,
} from "./takeoffBridge";

/**
 * React plumbing for the takeoff bridge.
 *
 * The provider is mounted once by `AppLayout`, which owns the global
 * `takeoffData` state. Tools call `publish(items, source)` after a successful
 * generation; the returning value is what the taking-off / dimension paper /
 * BOQ routes render.
 *
 * The default value is a no-op bridge so tools render safely in isolation (for
 * example in a future unit test or a story) without a provider.
 */
const noopBridge = {
  items: [],
  publish: () => {},
  clearSource: () => {},
  count: () => 0,
};

export const TakeoffBridgeContext = createContext(noopBridge);

export const TakeoffBridgeProvider = ({ items, setItems, children }) => {
  const value = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    return {
      items: safeItems,
      publish: (incoming, source) =>
        setItems((previous) => publishSourceBatch(previous, incoming, source)),
      clearSource: (source) =>
        setItems((previous) => clearSourceBatch(previous, source)),
      count: (source) => countSourceBatch(safeItems, source),
    };
  }, [items, setItems]);

  return (
    <TakeoffBridgeContext.Provider value={value}>{children}</TakeoffBridgeContext.Provider>
  );
};

/** Access the bridge: `{ items, publish, clearSource, count }`. */
export const useTakeoffBridge = () => useContext(TakeoffBridgeContext);

export default TakeoffBridgeContext;
