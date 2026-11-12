// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "word-builder:v1";

/** A fresh copy of every game module, so the store starts unread. */
async function freshModules() {
  vi.resetModules();
  const progress = await import("./progress.ts");
  const store = await import("./store.ts");
  const content = await import("../content/derive.ts");
  return { progress, store, content };
}

function throwingStorage(options: {
  readonly read: boolean;
  readonly write: boolean;
}): Storage {
  const data = new Map<string, string>();
  return {
    get length(): number {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => {
      if (options.read) throw new Error("read failed");
      return data.get(key) ?? null;
    },
    key: () => null,
    removeItem: (key) => {
      if (options.write) throw new Error("erase failed");
      data.delete(key);
    },
    setItem: (key, value) => {
      if (options.write) throw new Error("write failed");
      data.set(key, value);
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("store", () => {
  it("starts empty when nothing is stored", async () => {
    const { progress, store } = await freshModules();
    expect(store.getProgress()).toEqual(progress.EMPTY_PROGRESS);
  });

  it("reads storage once, on first call", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, completedRounds: ["01-at"] }),
    );
    const { store } = await freshModules();
    expect(store.getProgress().completedRounds).toEqual(["01-at"]);
    localStorage.setItem(KEY, JSON.stringify({ version: 1 }));
    expect(store.getProgress().completedRounds).toEqual(["01-at"]);
  });

  it("updateProgress sets the live value, returns it and persists it", async () => {
    const { progress, store, content } = await freshModules();
    const round = content.roundById("01-at");
    if (round === undefined) throw new Error("Missing round");
    const next = store.updateProgress((current) =>
      progress.completeRound(current, round),
    );
    expect(next.completedRounds).toEqual(["01-at"]);
    expect(store.getProgress()).toBe(next);
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    expect(progress.parseProgress(stored)).toEqual(next);
  });

  it("a new module instance loads what the last one saved", async () => {
    const first = await freshModules();
    first.store.updateProgress(first.progress.setSeenDragDemo);
    const second = await freshModules();
    expect(second.store.getProgress().seenDragDemo).toBe(true);
  });

  it("change functions receive the current value", async () => {
    const { progress, store } = await freshModules();
    store.updateProgress((c) => progress.setUnlockAll(c, true));
    const seen: boolean[] = [];
    store.updateProgress((c) => {
      seen.push(c.unlockAll);
      return c;
    });
    expect(seen).toEqual([true]);
  });

  it("resetProgress empties the live value and erases storage", async () => {
    const { progress, store } = await freshModules();
    store.updateProgress(progress.setSeenDragDemo);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    store.resetProgress();
    expect(store.getProgress()).toEqual(progress.EMPTY_PROGRESS);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("corrupt stored JSON gives an empty live value", async () => {
    localStorage.setItem(KEY, "}{");
    const { progress, store } = await freshModules();
    expect(store.getProgress()).toEqual(progress.EMPTY_PROGRESS);
  });

  it("storage that throws on read gives an empty live value that can be updated", async () => {
    vi.stubGlobal(
      "localStorage",
      throwingStorage({ read: true, write: false }),
    );
    const { progress, store } = await freshModules();
    expect(store.getProgress()).toEqual(progress.EMPTY_PROGRESS);
    const next = store.updateProgress(progress.setSeenDragDemo);
    expect(next.seenDragDemo).toBe(true);
    expect(store.getProgress().seenDragDemo).toBe(true);
  });

  it("the live value survives storage that throws on write", async () => {
    vi.stubGlobal(
      "localStorage",
      throwingStorage({ read: false, write: true }),
    );
    const { progress, store } = await freshModules();
    store.updateProgress(progress.setSeenDragDemo);
    store.updateProgress((c) => progress.setUnlockAll(c, true));
    expect(store.getProgress().seenDragDemo).toBe(true);
    expect(store.getProgress().unlockAll).toBe(true);
    expect(() => {
      store.resetProgress();
    }).not.toThrow();
    expect(store.getProgress()).toEqual(progress.EMPTY_PROGRESS);
  });
});
