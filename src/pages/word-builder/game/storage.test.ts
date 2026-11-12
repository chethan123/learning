// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { roundById } from "../content/derive.ts";
import type { Round } from "../content/types.ts";
import {
  completeRound,
  EMPTY_PROGRESS,
  recordFound,
  setSeenDragDemo,
} from "./progress.ts";
import {
  eraseStoredProgress,
  readStoredProgress,
  writeStoredProgress,
} from "./storage.ts";

const KEY = "word-builder:v1";

function getRound(id: string): Round {
  const round = roundById(id);
  if (round === undefined) throw new Error(`Missing test round ${id}`);
  return round;
}

function throwingStorage(): Storage {
  const fail = (): never => {
    throw new Error("storage unavailable");
  };
  return {
    get length(): number {
      return fail();
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage", () => {
  it("reads EMPTY_PROGRESS when nothing is stored", () => {
    expect(readStoredProgress()).toEqual(EMPTY_PROGRESS);
  });

  it("round-trips progress under the versioned key", () => {
    const progress = setSeenDragDemo(
      recordFound(
        completeRound(EMPTY_PROGRESS, getRound("01-at")),
        getRound("09-at-ap"),
        "cat",
      ),
    );
    writeStoredProgress(progress);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(readStoredProgress()).toEqual(progress);
  });

  it("erase removes the key", () => {
    writeStoredProgress(setSeenDragDemo(EMPTY_PROGRESS));
    eraseStoredProgress();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readStoredProgress()).toEqual(EMPTY_PROGRESS);
  });

  it("corrupt JSON gives EMPTY_PROGRESS", () => {
    localStorage.setItem(KEY, "{not json");
    expect(readStoredProgress()).toEqual(EMPTY_PROGRESS);
  });

  it.each(["null", "42", '"text"', "[]", '{"version":2}'])(
    "valid JSON that is not progress (%s) gives EMPTY_PROGRESS",
    (text) => {
      localStorage.setItem(KEY, text);
      expect(readStoredProgress()).toEqual(EMPTY_PROGRESS);
    },
  );

  it("sanitises stored values", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        completedRounds: ["01-at", "nope"],
        unlockAll: true,
      }),
    );
    const progress = readStoredProgress();
    expect(progress.completedRounds).toEqual(["01-at"]);
    expect(progress.unlockAll).toBe(true);
  });

  it("swallows a storage that throws on read", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(readStoredProgress()).toEqual(EMPTY_PROGRESS);
  });

  it("swallows a storage that throws on write and on erase", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(() => {
      writeStoredProgress(EMPTY_PROGRESS);
    }).not.toThrow();
    expect(() => {
      eraseStoredProgress();
    }).not.toThrow();
  });
});
