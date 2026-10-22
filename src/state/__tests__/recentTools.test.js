import {
  RECENT_TOOLS_LIMIT,
  normaliseEntry,
  parseStoredHistory,
  recordToolVisit,
  readRecentTools,
  writeRecentTools,
  rememberToolVisit,
  clearRecentTools,
  RECENT_TOOLS_STORAGE_KEY,
} from "../recentTools";

const tool = (n, path = `/structural/manual/tool-${n}`) => ({
  path,
  title: `Tool ${n}`,
  group: "Structural design",
});

const NOW = 1_700_000_000_000;

beforeEach(() => {
  window.localStorage.clear();
});

describe("recordToolVisit", () => {
  test("adds a visit to the front with its metadata", () => {
    const list = recordToolVisit([], tool(1), NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      path: tool(1).path,
      title: "Tool 1",
      group: "Structural design",
      visitedAt: NOW,
    });
  });

  test("does not duplicate the same path — it moves to the top", () => {
    let list = recordToolVisit([], tool(1), NOW);
    list = recordToolVisit(list, tool(2), NOW + 1000);
    list = recordToolVisit(list, tool(1), NOW + 2000);

    expect(list).toHaveLength(2);
    expect(list[0].path).toBe(tool(1).path);
    expect(list[0].visitedAt).toBe(NOW + 2000);
    expect(list.filter((i) => i.path === tool(1).path)).toHaveLength(1);
  });

  test("caps the list at the configured limit, newest first", () => {
    let list = [];
    for (let i = 0; i < RECENT_TOOLS_LIMIT + 5; i += 1) {
      list = recordToolVisit(list, tool(i), NOW + i * 1000);
    }
    expect(list).toHaveLength(RECENT_TOOLS_LIMIT);
    expect(list[0].title).toBe(`Tool ${RECENT_TOOLS_LIMIT + 4}`);
  });

  test("ignores invalid tool input instead of throwing", () => {
    expect(recordToolVisit([], null, NOW)).toEqual([]);
    expect(recordToolVisit([], { path: "", title: "x" }, NOW)).toEqual([]);
    expect(recordToolVisit([], { path: "javascript:alert(1)", title: "x" }, NOW)).toEqual([]);
    expect(recordToolVisit([], { path: "/ok", title: "" }, NOW)).toEqual([]);
  });
});

describe("normaliseEntry / parseStoredHistory", () => {
  test("rejects entries that are not safe tool routes", () => {
    expect(normaliseEntry(null)).toBeNull();
    expect(normaliseEntry({ path: "relative/path", title: "x", visitedAt: NOW })).toBeNull();
    expect(normaliseEntry({ path: "//evil.example", title: "x", visitedAt: NOW })).toBeNull();
    expect(normaliseEntry({ path: "/ok", title: "", visitedAt: NOW })).toBeNull();
    expect(normaliseEntry({ path: "/ok", title: "x", visitedAt: "not-a-number" })).toBeNull();
    expect(
      normaliseEntry({ path: "/ok", title: "x", visitedAt: Date.now() + 10 * 24 * 60 * 60 * 1000 })
    ).toBeNull();
  });

  test("returns an empty list for malformed JSON or wrong shapes", () => {
    expect(parseStoredHistory("not json")).toEqual([]);
    expect(parseStoredHistory('{"path":"/x"}')).toEqual([]);
    expect(parseStoredHistory("null")).toEqual([]);
    expect(parseStoredHistory("")).toEqual([]);
  });

  test("drops invalid rows but keeps the valid ones, newest first", () => {
    const raw = JSON.stringify([
      { path: "/b", title: "B", group: "G", visitedAt: NOW - 1000 },
      { path: "/a", title: "A", group: "G", visitedAt: NOW },
      { path: "bad", title: "Bad", visitedAt: NOW },
    ]);
    const parsed = parseStoredHistory(raw);
    expect(parsed.map((i) => i.path)).toEqual(["/a", "/b"]);
  });
});

describe("localStorage persistence", () => {
  test("round-trips a recorded visit", () => {
    rememberToolVisit(tool(1), NOW);
    const stored = readRecentTools();
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Tool 1");
    expect(window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY)).toContain("Tool 1");
  });

  test("survives corrupt stored data and repairs it on the next write", () => {
    window.localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, "{broken");
    expect(readRecentTools()).toEqual([]);

    rememberToolVisit(tool(2), NOW);
    expect(readRecentTools()).toHaveLength(1);
  });

  test("writeRecentTools sanitises the payload", () => {
    writeRecentTools([{ path: "bad", title: "x", visitedAt: NOW }, { path: "/ok", title: "OK", visitedAt: NOW }]);
    const raw = JSON.parse(window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY));
    expect(raw).toHaveLength(1);
    expect(raw[0].path).toBe("/ok");
  });

  test("clearRecentTools empties the history", () => {
    rememberToolVisit(tool(1), NOW);
    clearRecentTools();
    expect(readRecentTools()).toEqual([]);
  });

  test("only tool metadata is stored (no inputs or results)", () => {
    rememberToolVisit(tool(3), NOW);
    const raw = window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY);
    expect(raw).not.toMatch(/quantity|payload|result|calculation/i);
    const parsed = JSON.parse(raw)[0];
    expect(Object.keys(parsed).sort()).toEqual(["group", "path", "title", "visitedAt"]);
  });
});
