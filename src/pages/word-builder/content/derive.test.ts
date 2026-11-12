import { describe, expect, it } from "vitest";

import {
  ALL_SOUNDS,
  ALL_WORDS,
  clipsOf,
  coverWord,
  roundById,
  wordsOf,
} from "./derive.ts";
import { ROUNDS } from "./rounds.ts";
import type { Clip, Round } from "./types.ts";

function getRound(id: string): Round {
  const round = roundById(id);
  if (round === undefined) throw new Error(`Missing test round ${id}`);
  return round;
}

describe("derived content", () => {
  it("has 61 rounds and 157 distinct words in introduction order", () => {
    expect(ROUNDS).toHaveLength(61);
    expect(ALL_WORDS).toHaveLength(157);
    expect(new Set(ALL_WORDS).size).toBe(157);
    expect(ALL_WORDS).toEqual([...new Set(ROUNDS.flatMap(wordsOf))]);
    expect(ALL_WORDS.slice(0, 5)).toEqual(["mat", "sat", "pat", "map", "tap"]);
    expect(ALL_WORDS.slice(-5)).toEqual([
      "pink",
      "sink",
      "wink",
      "skunk",
      "bunk",
    ]);
  });

  it("has exactly the 28 sorted sound ids", () => {
    expect(ALL_SOUNDS).toHaveLength(28);
    expect(ALL_SOUNDS).toEqual(
      "a b ch d e f g h i j k l m n ng o p r s sh t th u v w x y z".split(" "),
    );
  });

  it("keeps group and winning order, including review words", () => {
    expect(wordsOf(getRound("09-at-ap"))).toEqual([
      "cat",
      "mat",
      "sat",
      "cap",
      "map",
    ]);
  });

  it("uses the first introduction for each cover and throws when none exists", () => {
    for (const round of ROUNDS)
      expect(coverWord(round)).toBe(round.introduces[0]);
    const round = getRound("09-at-ap");
    expect(() => coverWord({ ...round, introduces: [] })).toThrow(/09-at-ap/);
    expect(coverWord(getRound("44-og-um-ab"))).toBe("frog");
  });

  it("looks up known rounds and rejects unknown ids", () => {
    expect(roundById("09-at-ap")).toBe(ROUNDS[8]);
    expect(roundById("09")).toBeUndefined();
    expect(roundById("missing")).toBeUndefined();
  });

  it("includes distinct words and every winning, extra and rest sound for round 44", () => {
    const clips = clipsOf(getRound("44-og-um-ab"));
    const expected: Clip[] = [
      ...["frog", "dog", "drum", "gum", "crab"].map((id): Clip => ({
        kind: "word",
        id,
      })),
      ...["f", "r", "d", "g", "o", "p", "u", "m", "k", "l", "a", "b"].map(
        (id): Clip => ({ kind: "sound", id }),
      ),
    ];
    const key = (clip: Clip): string => `${clip.kind}:${clip.id}`;
    expect(new Set(clips.map(key))).toEqual(new Set(expected.map(key)));
    expect(clips).toHaveLength(expected.length);
    // l is needed only by the extra blend pl; extra combinations are never word clips.
    expect(clips).toContainEqual({ kind: "sound", id: "l" });
    expect(clips).not.toContainEqual({ kind: "word", id: "plab" });
  });
});
