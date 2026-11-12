import { describe, expect, it } from "vitest";

import { roundById, wordsOf } from "../content/derive.ts";
import type { Round } from "../content/types.ts";
import {
  currentGroup,
  hintTile,
  nextGroup,
  place,
  startSession,
  tray,
  trayPositions,
  type Outcome,
  type Session,
} from "./session.ts";

function getRound(id: string): Round {
  const round = roundById(id);
  if (round === undefined) throw new Error(`Missing test round ${id}`);
  return round;
}

function placeAll(
  session: Session,
  tiles: readonly string[],
): { session: Session; outcomes: Outcome[] } {
  let current = session;
  const outcomes: Outcome[] = [];
  for (const tile of tiles) {
    const result = place(current, tile);
    current = result.session;
    outcomes.push(result.outcome);
  }
  return { session: current, outcomes };
}

const round01 = getRound("01-at");
const round09 = getRound("09-at-ap");
const round11 = getRound("11-ug");
const round19 = getRound("19-up-um-us");
const round43 = getRound("43-ilk-ift-esk-ant");
const round44 = getRound("44-og-um-ab");

describe("startSession", () => {
  it("starts a guided round at group 0 with nothing found", () => {
    expect(startSession(round01, "guided")).toEqual({
      round: round01,
      mode: "guided",
      groupIndex: 0,
      found: [],
      misses: 0,
    });
  });

  it("starts free play at group 0 and ignores alreadyFound", () => {
    const session = startSession(round09, "free", ["cat", "mat", "sat"]);
    expect(session.groupIndex).toBe(0);
    expect(session.found).toEqual([]);
    expect(session.mode).toBe("free");
  });

  it("resumes at the first group with a word still to find", () => {
    const session = startSession(round09, "guided", ["cat", "mat", "sat"]);
    expect(session.groupIndex).toBe(1);
    expect(session.found).toEqual(["cat", "mat", "sat"]);
    expect(tray(session)).toEqual(["c", "m"]);
  });

  it("stays in a partly found group", () => {
    const session = startSession(round09, "guided", ["mat"]);
    expect(session.groupIndex).toBe(0);
    expect(tray(session)).toEqual(["c", "s"]);
  });

  it("ignores words that are not in the round and duplicates", () => {
    const session = startSession(round01, "guided", [
      "dog",
      "mat",
      "mat",
      "sat",
      "mat",
    ]);
    expect(session.found).toEqual(["mat", "sat"]);
  });

  it("throws when every word is already found", () => {
    expect(() =>
      startSession(round01, "guided", ["mat", "sat", "pat"]),
    ).toThrow();
  });
});

describe("tray and trayPositions", () => {
  it("lists winning tiles and extras alphabetically", () => {
    const session = startSession(round11, "guided");
    expect(currentGroup(session).rest).toBe("ug");
    expect(trayPositions(session)).toEqual(["b", "g", "m"]);
    expect(tray(session)).toEqual(["b", "g", "m"]);
  });

  it("sorts blends among single letters", () => {
    const session = startSession(round44, "guided");
    expect(trayPositions(session)).toEqual(["d", "fr", "g"]);
  });

  it("guided tray drops found tiles but positions stay fixed", () => {
    const { session } = placeAll(startSession(round11, "guided"), ["m"]);
    expect(trayPositions(session)).toEqual(["b", "g", "m"]);
    expect(tray(session)).toEqual(["b", "g"]);
  });

  it("free tray always equals the positions", () => {
    const { session } = placeAll(startSession(round11, "free"), ["m", "g"]);
    expect(tray(session)).toEqual(trayPositions(session));
    expect(tray(session)).toEqual(["b", "g", "m"]);
  });
});

describe("place in guided mode", () => {
  it("finds a word with its goal slot", () => {
    const { session, outcome } = place(startSession(round01, "guided"), "s");
    expect(outcome).toEqual({
      kind: "found",
      word: "sat",
      slot: 1,
      groupDone: false,
      roundDone: false,
    });
    expect(session.found).toEqual(["sat"]);
    expect(session.groupIndex).toBe(0);
  });

  it("slot is the index in wordsOf across groups", () => {
    const start = startSession(round09, "guided", ["cat", "mat", "sat"]);
    const { outcome } = place(start, "m");
    expect(outcome).toMatchObject({ kind: "found", word: "map", slot: 4 });
    expect(wordsOf(round09)[4]).toBe("map");
  });

  it("counts misses and keeps the tile in the tray", () => {
    const start = startSession(round11, "guided");
    const first = place(start, "g");
    expect(first.outcome).toEqual({ kind: "miss" });
    expect(first.session.misses).toBe(1);
    expect(tray(first.session)).toContain("g");
    expect(place(first.session, "g").session.misses).toBe(2);
  });

  it("reports groupDone and roundDone", () => {
    const { outcomes } = placeAll(startSession(round01, "guided"), [
      "m",
      "s",
      "p",
    ]);
    expect(outcomes).toEqual([
      {
        kind: "found",
        word: "mat",
        slot: 0,
        groupDone: false,
        roundDone: false,
      },
      {
        kind: "found",
        word: "sat",
        slot: 1,
        groupDone: false,
        roundDone: false,
      },
      { kind: "found", word: "pat", slot: 2, groupDone: true, roundDone: true },
    ]);
  });

  it("groupDone does not mean roundDone in a multi-group round", () => {
    const { outcomes } = placeAll(startSession(round09, "guided"), [
      "c",
      "m",
      "s",
    ]);
    expect(outcomes[2]).toMatchObject({
      kind: "found",
      groupDone: true,
      roundDone: false,
    });
  });

  it("never changes groupIndex", () => {
    const { session } = placeAll(startSession(round09, "guided"), [
      "c",
      "m",
      "s",
    ]);
    expect(session.groupIndex).toBe(0);
  });

  it("throws for a tile outside the tray", () => {
    const session = startSession(round11, "guided");
    expect(() => place(session, "x")).toThrow();
    const after = place(session, "m").session;
    expect(() => place(after, "m")).toThrow();
  });
});

describe("hintTile", () => {
  it("appears after two misses and names the first winning tile", () => {
    let session = startSession(round11, "guided");
    expect(hintTile(session)).toBeUndefined();
    session = place(session, "g").session;
    expect(hintTile(session)).toBeUndefined();
    session = place(session, "g").session;
    expect(hintTile(session)).toBe("b");
  });

  it("skips found tiles and resets after a found word", () => {
    let session = startSession(round11, "guided");
    session = place(session, "b").session;
    session = place(session, "g").session;
    session = place(session, "g").session;
    expect(hintTile(session)).toBe("m");
    const found = place(session, "m");
    expect(found.session.misses).toBe(0);
    expect(hintTile(found.session)).toBeUndefined();
  });

  it("is never given in free play", () => {
    let session = startSession(round11, "free");
    session = place(session, "g").session;
    session = place(session, "g").session;
    expect(hintTile(session)).toBeUndefined();
  });
});

describe("free mode", () => {
  it("shows words for winning tiles and misses for extras", () => {
    const session = startSession(round11, "free");
    expect(place(session, "b").outcome).toEqual({ kind: "shown", word: "bug" });
    expect(place(session, "g").outcome).toEqual({ kind: "miss" });
  });

  it("never yields found and returns the session unchanged", () => {
    const session = startSession(round09, "free");
    for (const tile of trayPositions(session)) {
      const result = place(session, tile);
      expect(result.outcome.kind).not.toBe("found");
      expect(result.session).toBe(session);
    }
  });

  it("throws for a tile outside the tray", () => {
    expect(() => place(startSession(round11, "free"), "z")).toThrow();
  });

  it("cycles groups and wraps", () => {
    let session = startSession(round19, "free");
    expect(currentGroup(session).rest).toBe("up");
    session = nextGroup(session);
    expect(currentGroup(session).rest).toBe("um");
    session = nextGroup(session);
    session = nextGroup(session);
    expect(currentGroup(session).rest).toBe("up");
    expect(session.found).toEqual([]);
  });

  it("wraps on a single-group round", () => {
    const session = startSession(round01, "free");
    expect(nextGroup(session).groupIndex).toBe(0);
  });
});

describe("guided nextGroup", () => {
  it("moves to the next group once the current one is done", () => {
    const { session } = placeAll(startSession(round09, "guided"), [
      "c",
      "m",
      "s",
    ]);
    const next = nextGroup(session);
    expect(next.groupIndex).toBe(1);
    expect(next.misses).toBe(0);
    expect(tray(next)).toEqual(["c", "m"]);
  });

  it("resets misses", () => {
    let session = startSession(round19, "guided");
    session = placeAll(session, ["c", "p"]).session;
    expect(nextGroup(session).misses).toBe(0);
  });

  it("throws while the current group has an unfound word", () => {
    const session = startSession(round09, "guided");
    expect(() => nextGroup(session)).toThrow();
    const partial = place(session, "c").session;
    expect(() => nextGroup(partial)).toThrow();
  });

  it("throws on the last group", () => {
    const { session } = placeAll(startSession(round01, "guided"), [
      "m",
      "s",
      "p",
    ]);
    expect(() => nextGroup(session)).toThrow();
  });

  it("throws when the later groups are all found", () => {
    const session = startSession(round09, "guided", ["cap", "map"]);
    const done = placeAll(session, ["c", "m", "s"]).session;
    expect(() => nextGroup(done)).toThrow();
  });

  it("skips a group that was already found (round 43, resumed with gift)", () => {
    const session = startSession(round43, "guided", ["gift"]);
    expect(currentGroup(session).rest).toBe("ilk");
    expect(tray(session)).toEqual(["m", "n", "t"]);

    const milk = place(session, "m");
    expect(milk.outcome).toEqual({
      kind: "found",
      word: "milk",
      slot: 0,
      groupDone: true,
      roundDone: false,
    });

    const second = nextGroup(milk.session);
    expect(currentGroup(second).rest).toBe("esk");

    const desk = place(second, "d");
    expect(desk.outcome).toMatchObject({
      kind: "found",
      word: "desk",
      groupDone: true,
      roundDone: false,
    });

    const third = nextGroup(desk.session);
    expect(currentGroup(third).rest).toBe("ant");
    const plant = place(third, "pl");
    expect(plant.outcome).toMatchObject({
      kind: "found",
      word: "plant",
      slot: 3,
      groupDone: true,
      roundDone: true,
    });
    expect(plant.session.found).toEqual(["gift", "milk", "desk", "plant"]);
    expect(() => nextGroup(plant.session)).toThrow();
  });

  it("walks through every group of a round from the start", () => {
    let session = startSession(round19, "guided");
    session = placeAll(session, ["c", "p"]).session;
    session = nextGroup(session);
    session = place(session, "g").session;
    session = nextGroup(session);
    const last = place(session, "b");
    expect(last.outcome).toMatchObject({ roundDone: true, word: "bus" });
  });
});
