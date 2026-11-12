import { describe, expect, it } from "vitest";

import { roundById, wordsOf } from "../content/derive.ts";
import { ROUNDS } from "../content/rounds.ts";
import type { Round } from "../content/types.ts";
import {
  canFreePlay,
  canPlay,
  completeRound,
  currentRound,
  EMPTY_PROGRESS,
  parseProgress,
  recordFound,
  resumeWords,
  setSeenDragDemo,
  setUnlockAll,
  stoneStates,
  type Progress,
} from "./progress.ts";
import { place, startSession } from "./session.ts";

function getRound(id: string): Round {
  const round = roundById(id);
  if (round === undefined) throw new Error(`Missing test round ${id}`);
  return round;
}

const round01 = getRound("01-at");
const round02 = getRound("02-ap");
const round03 = getRound("03-in");
const round09 = getRound("09-at-ap");
const round11 = getRound("11-ug");

function completed(count: number): Progress {
  return ROUNDS.slice(0, count).reduce(completeRound, EMPTY_PROGRESS);
}

describe("parseProgress", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "progress"],
    ["a number", 7],
    ["an array", []],
    ["wrong version", { version: 2, completedRounds: ["01-at"] }],
    ["string version", { version: "1" }],
    ["no version", { completedRounds: ["01-at"] }],
  ])("returns EMPTY_PROGRESS for %s", (_name, raw) => {
    expect(parseProgress(raw)).toEqual(EMPTY_PROGRESS);
  });

  it("returns EMPTY_PROGRESS shape for a bare version", () => {
    expect(parseProgress({ version: 1 })).toEqual(EMPTY_PROGRESS);
  });

  it("round-trips a valid value through JSON", () => {
    const progress = setSeenDragDemo(
      setUnlockAll(
        recordFound(completeRound(EMPTY_PROGRESS, round01), round02, "map"),
        true,
      ),
    );
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(
      progress,
    );
  });

  it("takes the empty value for each wrongly typed field", () => {
    const parsed = parseProgress({
      version: 1,
      completedRounds: "01-at",
      foundWords: { 0: "mat" },
      inProgress: "nope",
      unlockAll: "yes",
      seenDragDemo: 1,
    });
    expect(parsed).toEqual(EMPTY_PROGRESS);
  });

  it("reads each field on its own", () => {
    const parsed = parseProgress({
      version: 1,
      completedRounds: ["01-at"],
      foundWords: 5,
      unlockAll: true,
      seenDragDemo: "x",
    });
    expect(parsed.completedRounds).toEqual(["01-at"]);
    expect(parsed.foundWords).toEqual([]);
    expect(parsed.unlockAll).toBe(true);
    expect(parsed.seenDragDemo).toBe(false);
  });

  it("drops non-strings, unknown ids and words, and duplicates", () => {
    const parsed = parseProgress({
      version: 1,
      completedRounds: ["02-ap", 3, null, "99-zz", "01-at", "02-ap"],
      foundWords: ["tap", "xyz", 1, "map", "tap", {}],
    });
    expect(parsed.completedRounds).toEqual(["02-ap", "01-at"]);
    expect(parsed.foundWords).toEqual(["tap", "map"]);
  });

  describe("inProgress", () => {
    const base = { version: 1, completedRounds: [] };

    it("keeps a valid entry and drops other words and duplicates", () => {
      const parsed = parseProgress({
        ...base,
        inProgress: [{ roundId: "01-at", found: ["sat", "dog", 4, "sat"] }],
      });
      expect(parsed.inProgress).toEqual([{ roundId: "01-at", found: ["sat"] }]);
    });

    it("becomes [] when not an array", () => {
      for (const inProgress of [
        null,
        "x",
        3,
        { roundId: "01-at", found: ["mat"] },
      ]) {
        expect(parseProgress({ ...base, inProgress }).inProgress).toEqual([]);
      }
    });

    it("drops entries that are not objects or have a bad round id", () => {
      const parsed = parseProgress({
        ...base,
        inProgress: [
          null,
          "01-at",
          { found: ["mat"] },
          { roundId: 1, found: ["mat"] },
          { roundId: "99-zz", found: ["mat"] },
        ],
      });
      expect(parsed.inProgress).toEqual([]);
    });

    it("drops entries with a non-array found, none, or all words found", () => {
      const parsed = parseProgress({
        ...base,
        inProgress: [
          { roundId: "01-at", found: "mat" },
          { roundId: "02-ap", found: [] },
          { roundId: "03-in", found: ["fin", "pin"] },
          { roundId: "01-at", found: ["dog"] },
        ],
      });
      expect(parsed.inProgress).toEqual([]);
    });

    it("drops entries for completed rounds", () => {
      const parsed = parseProgress({
        version: 1,
        completedRounds: ["01-at"],
        inProgress: [
          { roundId: "01-at", found: ["mat"] },
          { roundId: "02-ap", found: ["map"] },
        ],
      });
      expect(parsed.inProgress).toEqual([{ roundId: "02-ap", found: ["map"] }]);
    });

    it("keeps several rounds and only the first entry per round", () => {
      const parsed = parseProgress({
        ...base,
        inProgress: [
          { roundId: "09-at-ap", found: ["cat"] },
          { roundId: "11-ug", found: ["bug"] },
          { roundId: "09-at-ap", found: ["map"] },
        ],
      });
      expect(parsed.inProgress).toEqual([
        { roundId: "09-at-ap", found: ["cat"] },
        { roundId: "11-ug", found: ["bug"] },
      ]);
    });
  });
});

describe("recordFound", () => {
  it("adds the word to foundWords and starts an entry", () => {
    const next = recordFound(EMPTY_PROGRESS, round01, "mat");
    expect(next.foundWords).toEqual(["mat"]);
    expect(next.inProgress).toEqual([{ roundId: "01-at", found: ["mat"] }]);
  });

  it("is idempotent", () => {
    const once = recordFound(EMPTY_PROGRESS, round01, "mat");
    expect(recordFound(once, round01, "mat")).toEqual(once);
  });

  it("appends to this round's entry in order", () => {
    let progress = recordFound(EMPTY_PROGRESS, round01, "sat");
    progress = recordFound(progress, round01, "mat");
    expect(progress.inProgress).toEqual([
      { roundId: "01-at", found: ["sat", "mat"] },
    ]);
  });

  it("keeps other rounds' entries", () => {
    let progress = recordFound(EMPTY_PROGRESS, round09, "cat");
    progress = recordFound(progress, round11, "bug");
    progress = recordFound(progress, round09, "map");
    expect(progress.inProgress).toEqual([
      { roundId: "09-at-ap", found: ["cat", "map"] },
      { roundId: "11-ug", found: ["bug"] },
    ]);
  });

  it("does not mutate its input", () => {
    const start = recordFound(EMPTY_PROGRESS, round01, "mat");
    recordFound(start, round01, "sat");
    expect(start.inProgress).toEqual([{ roundId: "01-at", found: ["mat"] }]);
    expect(EMPTY_PROGRESS.inProgress).toEqual([]);
  });
});

describe("resumeWords", () => {
  it("returns the found words of an unfinished round", () => {
    const progress = recordFound(EMPTY_PROGRESS, round09, "cat");
    expect(resumeWords(progress, round09)).toEqual(["cat"]);
  });

  it("returns nothing for another round or a fresh round", () => {
    const progress = recordFound(EMPTY_PROGRESS, round09, "cat");
    expect(resumeWords(progress, round11)).toEqual([]);
    expect(resumeWords(EMPTY_PROGRESS, round01)).toEqual([]);
  });

  it("feeds startSession to resume a half-finished round", () => {
    let session = startSession(
      round09,
      "guided",
      resumeWords(EMPTY_PROGRESS, round09),
    );
    let progress: Progress = EMPTY_PROGRESS;
    for (const tile of ["c", "m"]) {
      const result = place(session, tile);
      session = result.session;
      if (result.outcome.kind === "found") {
        progress = recordFound(progress, round09, result.outcome.word);
      }
    }
    const resumed = startSession(
      round09,
      "guided",
      resumeWords(progress, round09),
    );
    expect(resumed.found).toEqual(["cat", "mat"]);
    expect(resumed.groupIndex).toBe(0);
  });

  it("keeps two unlocked rounds half-finished and resumes both", () => {
    let progress = setUnlockAll(EMPTY_PROGRESS, true);
    progress = recordFound(progress, round09, "map");
    progress = recordFound(progress, round11, "mug");
    expect(canPlay(progress, round09)).toBe(true);
    expect(canPlay(progress, round11)).toBe(true);
    expect(resumeWords(progress, round09)).toEqual(["map"]);
    expect(resumeWords(progress, round11)).toEqual(["mug"]);
    // Survives a save and load.
    const reloaded = parseProgress(JSON.parse(JSON.stringify(progress)));
    expect(resumeWords(reloaded, round09)).toEqual(["map"]);
    expect(resumeWords(reloaded, round11)).toEqual(["mug"]);
  });
});

describe("completeRound", () => {
  it("marks the round and its words, and is idempotent", () => {
    const once = completeRound(EMPTY_PROGRESS, round01);
    expect(once.completedRounds).toEqual(["01-at"]);
    expect(once.foundWords).toEqual(wordsOf(round01));
    expect(completeRound(once, round01)).toEqual(once);
  });

  it("clears this round's entry only", () => {
    let progress = recordFound(EMPTY_PROGRESS, round09, "cat");
    progress = recordFound(progress, round11, "bug");
    progress = completeRound(progress, round09);
    expect(progress.inProgress).toEqual([{ roundId: "11-ug", found: ["bug"] }]);
    expect(resumeWords(progress, round09)).toEqual([]);
  });

  it("does not duplicate words already found", () => {
    let progress = recordFound(EMPTY_PROGRESS, round01, "sat");
    progress = completeRound(progress, round01);
    expect(progress.foundWords).toEqual(["sat", "mat", "pat"]);
  });
});

describe("flags", () => {
  it("setUnlockAll toggles and is idempotent", () => {
    const on = setUnlockAll(EMPTY_PROGRESS, true);
    expect(on.unlockAll).toBe(true);
    expect(setUnlockAll(on, true)).toEqual(on);
    expect(setUnlockAll(on, false).unlockAll).toBe(false);
  });

  it("setSeenDragDemo is idempotent", () => {
    const once = setSeenDragDemo(EMPTY_PROGRESS);
    expect(once.seenDragDemo).toBe(true);
    expect(setSeenDragDemo(once)).toEqual(once);
  });
});

describe("stoneStates and currentRound", () => {
  it("at the start: first current, rest locked", () => {
    const states = stoneStates(EMPTY_PROGRESS);
    expect(states).toHaveLength(ROUNDS.length);
    expect(states[0]).toBe("current");
    expect(states.slice(1).every((s) => s === "locked")).toBe(true);
    expect(currentRound(EMPTY_PROGRESS)).toBe(round01);
  });

  it("in the middle: done, one current, locked", () => {
    const progress = completed(10);
    const states = stoneStates(progress);
    expect(states.slice(0, 10).every((s) => s === "done")).toBe(true);
    expect(states[10]).toBe("current");
    expect(states.slice(11).every((s) => s === "locked")).toBe(true);
    expect(currentRound(progress)?.number).toBe(11);
  });

  it("at the end: all done, no current round", () => {
    const progress = completed(ROUNDS.length);
    expect(stoneStates(progress).every((s) => s === "done")).toBe(true);
    expect(currentRound(progress)).toBeUndefined();
  });

  it("is not changed by unlockAll", () => {
    expect(stoneStates(setUnlockAll(EMPTY_PROGRESS, true))).toEqual(
      stoneStates(EMPTY_PROGRESS),
    );
  });

  it("treats the first not-completed round as current even after a gap", () => {
    const progress = completeRound(EMPTY_PROGRESS, round02);
    const states = stoneStates(progress);
    expect(states.slice(0, 3)).toEqual(["current", "done", "locked"]);
  });
});

describe("guards", () => {
  it("without unlockAll only the current round can be played", () => {
    const progress = completed(1);
    expect(canPlay(progress, round01)).toBe(false);
    expect(canPlay(progress, round02)).toBe(true);
    expect(canPlay(progress, round03)).toBe(false);
  });

  it("with unlockAll every uncompleted round can be played", () => {
    const progress = setUnlockAll(completed(1), true);
    expect(canPlay(progress, round01)).toBe(false);
    expect(canPlay(progress, round02)).toBe(true);
    expect(canPlay(progress, round03)).toBe(true);
    expect(canPlay(progress, round11)).toBe(true);
  });

  it("free play only for completed rounds, with or without unlockAll", () => {
    const progress = completed(1);
    expect(canFreePlay(progress, round01)).toBe(true);
    expect(canFreePlay(progress, round02)).toBe(false);
    const unlocked = setUnlockAll(progress, true);
    expect(canFreePlay(unlocked, round01)).toBe(true);
    expect(canFreePlay(unlocked, round02)).toBe(false);
  });
});
