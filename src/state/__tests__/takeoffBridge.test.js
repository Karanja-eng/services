import {
  TAKEOFF_SOURCE,
  publishSourceBatch,
  clearSourceBatch,
  countSourceBatch,
  batchFingerprint,
} from "../takeoffBridge";

const roofItem = (id) => ({
  id,
  billNo: `R${id}`,
  description: `Roof item ${id}`,
  unit: "m²",
  quantity: id * 10,
  rate: 0,
  amount: 0,
  dimensions: [],
});

const septicItem = (id) => ({
  id,
  billNo: `S${id}`,
  description: `Septic item ${id}`,
  unit: "m³",
  quantity: id,
  rate: 0,
  amount: 0,
  dimensions: [],
});

describe("takeoff bridge merge policy", () => {
  test("publishes items and tags them with source identity", () => {
    const merged = publishSourceBatch([], [roofItem(1), roofItem(2)], TAKEOFF_SOURCE.roof);

    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe(TAKEOFF_SOURCE.roof);
    expect(merged[0].sourceRef).toBe("roof:0");
    expect(merged[1].sourceRef).toBe("roof:1");
    expect(merged[0].sourceLabel).toBe("Roof takeoff");
  });

  test("re-publishing the same source replaces its batch (no duplicates)", () => {
    const first = publishSourceBatch([], [roofItem(1), roofItem(2)], TAKEOFF_SOURCE.roof);
    const second = publishSourceBatch(first, [roofItem(3)], TAKEOFF_SOURCE.roof);

    expect(second).toHaveLength(1);
    expect(second[0].description).toBe("Roof item 3");
    expect(second.filter((i) => i.source === TAKEOFF_SOURCE.roof)).toHaveLength(1);
  });

  test("never overwrites items from another source", () => {
    const manual = { ...roofItem(99), source: TAKEOFF_SOURCE.manual, description: "Manual row" };
    const withManual = publishSourceBatch([manual], [septicItem(1)], TAKEOFF_SOURCE.septic);

    expect(withManual.find((i) => i.description === "Manual row")).toBeDefined();
    expect(countSourceBatch(withManual, TAKEOFF_SOURCE.septic)).toBe(1);

    // Re-publishing roof keeps the manual row and the septic batch.
    const afterRoof = publishSourceBatch(withManual, [roofItem(2)], TAKEOFF_SOURCE.roof);
    expect(afterRoof.find((i) => i.description === "Manual row")).toBeDefined();
    expect(countSourceBatch(afterRoof, TAKEOFF_SOURCE.septic)).toBe(1);
    expect(countSourceBatch(afterRoof, TAKEOFF_SOURCE.roof)).toBe(1);
  });

  test("preserves the existing item schema fields verbatim", () => {
    const source = roofItem(4);
    const [merged] = publishSourceBatch([], [source], TAKEOFF_SOURCE.roof);

    expect(merged).toMatchObject({
      id: source.id,
      billNo: source.billNo,
      description: source.description,
      unit: source.unit,
      quantity: source.quantity,
      rate: source.rate,
      amount: source.amount,
      dimensions: source.dimensions,
    });
  });

  test("does not mutate the arrays it is given", () => {
    const existing = [{ ...roofItem(1), source: TAKEOFF_SOURCE.manual }];
    const incoming = [septicItem(2)];
    const existingSnapshot = JSON.parse(JSON.stringify(existing));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));

    publishSourceBatch(existing, incoming, TAKEOFF_SOURCE.septic);

    expect(existing).toEqual(existingSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  test("tolerates missing or malformed input", () => {
    expect(publishSourceBatch(undefined, undefined, TAKEOFF_SOURCE.roof)).toEqual([]);
    expect(publishSourceBatch(null, [roofItem(1)], TAKEOFF_SOURCE.roof)).toHaveLength(1);
  });

  test("clearSourceBatch removes only that source", () => {
    const merged = publishSourceBatch(
      publishSourceBatch([], [roofItem(1)], TAKEOFF_SOURCE.roof),
      [septicItem(1)],
      TAKEOFF_SOURCE.septic
    );

    const cleared = clearSourceBatch(merged, TAKEOFF_SOURCE.roof);
    expect(countSourceBatch(cleared, TAKEOFF_SOURCE.roof)).toBe(0);
    expect(countSourceBatch(cleared, TAKEOFF_SOURCE.septic)).toBe(1);
  });

  test("batchFingerprint changes when the batch changes", () => {
    const a = batchFingerprint([{ id: 1 }, { id: 2 }]);
    const b = batchFingerprint([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(a).not.toBe(b);
    expect(batchFingerprint([])).toBe("");
  });
});
