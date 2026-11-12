import dictionary from "an-array-of-english-words";
import { describe, expect, it } from "vitest";

import { ROUNDS } from "./rounds.ts";
import type { FrameGroup, Round } from "./types.ts";
import { validateContent } from "./validate.ts";

const DICTIONARY = new Set(dictionary);

function changeRound(number: number, change: Partial<Round>): readonly Round[] {
  return ROUNDS.map((round) =>
    round.number === number ? { ...round, ...change } : round,
  );
}

function changeGroup(
  number: number,
  change: Partial<FrameGroup>,
): readonly Round[] {
  return ROUNDS.map((round) =>
    round.number === number
      ? {
          ...round,
          groups: round.groups.map((group, index) =>
            index === 0 ? { ...group, ...change } : group,
          ),
        }
      : round,
  );
}

interface Fixture {
  readonly name: string;
  readonly rule: number;
  readonly number: number;
  readonly rounds: readonly Round[];
  readonly message: string;
}

describe("content validation", () => {
  it("accepts the real content against the English dictionary", () => {
    expect(validateContent(ROUNDS, DICTIONARY)).toEqual([]);
  });

  const fixtures: readonly Fixture[] = [
    {
      name: "round numbering",
      rule: 1,
      number: 1,
      rounds: changeRound(1, { number: 0 }),
      message: "number 0 must be 1",
    },
    {
      name: "id naming",
      rule: 1,
      number: 1,
      rounds: changeRound(1, { id: "incorrect" }),
      message: 'id must be "01-at"',
    },
    {
      name: "duplicate ids",
      rule: 1,
      number: 2,
      rounds: changeRound(2, { id: "01-at" }),
      message: "id is duplicated",
    },
    {
      name: "letter set below range",
      rule: 2,
      number: 1,
      rounds: changeRound(1, { letterSet: 0 }),
      message: "integer from 1 to 15",
    },
    {
      name: "letter set above range",
      rule: 2,
      number: 61,
      rounds: changeRound(61, { letterSet: 16 }),
      message: "integer from 1 to 15",
    },
    {
      name: "fractional letter set",
      rule: 2,
      number: 1,
      rounds: changeRound(1, { letterSet: 1.5 }),
      message: "integer from 1 to 15",
    },
    {
      name: "decreasing letter sets",
      rule: 2,
      number: 4,
      rounds: changeRound(4, { letterSet: 1 }),
      message: "decreases",
    },
    {
      name: "untaught target pattern",
      rule: 2,
      number: 44,
      rounds: changeRound(44, { letterSet: 8 }),
      message: '"frog" requires letter set 9',
    },
    {
      name: "untaught extra pattern",
      rule: 2,
      number: 11,
      rounds: changeGroup(11, { extras: ["th"] }),
      message: '"thug" requires letter set 13',
    },
    {
      name: "unknown letter",
      rule: 2,
      number: 11,
      rounds: changeGroup(11, { extras: ["q"] }),
      message: 'Unknown grapheme "q"',
    },
    {
      name: "p + lant counterexample",
      rule: 3,
      number: 43,
      rounds: changeGroup(43, { rest: "lant", winning: ["p"] }),
      message: 'rest "lant" must be one vowel',
    },
    {
      name: "second vowel in rest",
      rule: 3,
      number: 1,
      rounds: changeGroup(1, { rest: "ate" }),
      message: 'rest "ate" must be one vowel',
    },
    {
      name: "rest without consonant",
      rule: 3,
      number: 1,
      rounds: changeGroup(1, { rest: "a" }),
      message: 'rest "a" must be one vowel',
    },
    {
      name: "unknown rest letter",
      rule: 3,
      number: 1,
      rounds: changeGroup(1, { rest: "aq" }),
      message: 'rest "aq" must be one vowel',
    },
    {
      name: "duplicate rests",
      rule: 3,
      number: 9,
      rounds: changeRound(9, {
        groups: [
          { rest: "at", winning: ["c", "m"], extras: [] },
          { rest: "at", winning: ["s", "p"], extras: [] },
        ],
      }),
      message: 'rest "at" appears more than once',
    },
    {
      name: "empty winning tiles",
      rule: 4,
      number: 1,
      rounds: changeGroup(1, { winning: [] }),
      message: "has no winning tile",
    },
    {
      name: "duplicate winning tiles",
      rule: 4,
      number: 1,
      rounds: changeGroup(1, { winning: ["m", "m", "p"] }),
      message: 'repeats winning tile "m"',
    },
    {
      name: "vowel winning tile",
      rule: 4,
      number: 1,
      rounds: changeGroup(1, { winning: ["a", "s", "p"] }),
      message: 'invalid winning tile "a"',
    },
    {
      name: "disallowed winning digraph",
      rule: 4,
      number: 56,
      rounds: changeGroup(56, { winning: ["th", "p"] }),
      message: 'invalid winning tile "th"',
    },
    {
      name: "long winning tile",
      rule: 4,
      number: 1,
      rounds: changeGroup(1, { winning: ["str", "s", "p"] }),
      message: 'invalid winning tile "str"',
    },
    {
      name: "short target",
      rule: 5,
      number: 1,
      rounds: changeGroup(1, { rest: "a" }),
      message: 'target "ma" must have 3 to 5 letters',
    },
    {
      name: "long target",
      rule: 5,
      number: 1,
      rounds: changeGroup(1, { rest: "antst" }),
      message: 'target "mantst" must have 3 to 5 letters',
    },
    {
      name: "non-dictionary target",
      rule: 5,
      number: 11,
      rounds: changeGroup(11, { winning: ["g", "m"] }),
      message: 'target "gug" is not in the dictionary',
    },
    {
      name: "too few targets",
      rule: 5,
      number: 1,
      rounds: changeGroup(1, { winning: ["m"] }),
      message: "has 1 target words",
    },
    {
      name: "too many targets",
      rule: 5,
      number: 1,
      rounds: changeGroup(1, { winning: ["m", "s", "p", "c", "b", "r"] }),
      message: "has 6 target words",
    },
    {
      name: "too few group tiles",
      rule: 5,
      number: 11,
      rounds: changeGroup(11, { winning: [], extras: ["g"] }),
      message: "has 1 tiles",
    },
    {
      name: "too many group tiles",
      rule: 5,
      number: 33,
      rounds: changeGroup(33, { extras: ["h", "n"] }),
      message: "has 6 tiles",
    },
    {
      name: "cl + ock and c + lock counterexample",
      rule: 5,
      number: 51,
      rounds: changeRound(51, {
        groups: [
          { rest: "ock", winning: ["cl", "bl"], extras: [] },
          { rest: "lock", winning: ["c"], extras: ["z"] },
        ],
      }),
      message: 'target "clock" appears twice',
    },
    {
      name: "empty introduces",
      rule: 6,
      number: 1,
      rounds: changeRound(1, { introduces: [] }),
      message: "introduces must not be empty",
    },
    {
      name: "introduction order",
      rule: 6,
      number: 1,
      rounds: changeRound(1, { introduces: ["sat", "mat", "pat"] }),
      message: "in wordsOf order",
    },
    {
      name: "review word introduced twice",
      rule: 6,
      number: 4,
      rounds: changeRound(4, { introduces: ["nap", "map"] }),
      message: 'introduces must equal ["nap"]',
    },
    {
      name: "blocked target",
      rule: 7,
      number: 22,
      rounds: changeGroup(22, { winning: ["f", "r", "b"] }),
      message: '"fat" is in the blocklist',
    },
    {
      name: "blocked extra combination",
      rule: 7,
      number: 11,
      rounds: changeGroup(11, { extras: ["n"] }),
      message: '"nug" is in the blocklist',
    },
    {
      name: "blocked rest",
      rule: 7,
      number: 48,
      rounds: changeGroup(48, { rest: "ass" }),
      message: 'rest "ass" is in the blocklist',
    },
    {
      name: "disallowed extra letter",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["c"] }),
      message: 'invalid extra tile "c"',
    },
    {
      name: "disallowed extra vowel",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["a"] }),
      message: 'invalid extra tile "a"',
    },
    {
      name: "disallowed extra digraph",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["sh"] }),
      message: 'invalid extra tile "sh"',
    },
    {
      name: "extra also winning",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["b"] }),
      message: 'extra "b" is also a winning tile',
    },
    {
      name: "two-letter extra without a two-letter winner",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["fr"] }),
      message: "without a two-letter winning tile",
    },
    {
      name: "extra combination in ALL_WORDS",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["r"] }),
      message: 'extra combination "rug" is in ALL_WORDS',
    },
    {
      name: "extra combination in dictionary",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["d"] }),
      message: 'extra combination "dug" is in the dictionary',
    },
    {
      name: "too many extras with multiple winners",
      rule: 8,
      number: 11,
      rounds: changeGroup(11, { extras: ["g", "n"] }),
      message: "at most 1 allowed",
    },
    {
      name: "too many extras with one winner",
      rule: 8,
      number: 36,
      rounds: changeGroup(36, { extras: ["h", "w", "t"] }),
      message: "at most 2 allowed",
    },
    {
      name: "extras in the first ten rounds",
      rule: 8,
      number: 1,
      rounds: changeGroup(1, { extras: ["t"] }),
      message: "extras in rounds 01-10",
    },
    {
      name: "introduced-word counts",
      rule: 9,
      number: 61,
      rounds: changeRound(1, { introduces: ["mat", "sat"] }),
      message: "expected 87 introduced words of length 3, received 86",
    },
  ];

  it.each(fixtures)(
    "rejects $name (rule $rule)",
    ({ rule, number, rounds, message }) => {
      const round =
        rounds.find((candidate) => candidate.number === number) ?? rounds[0];
      if (round === undefined) throw new Error("Missing fixture round");
      const errors = validateContent(rounds, DICTIONARY);
      expect(errors).toContainEqual(
        expect.stringContaining(`Round ${round.id} (rule ${String(rule)}):`),
      );
      expect(
        errors.some(
          (error) =>
            error.includes(`(rule ${String(rule)}):`) &&
            error.includes(message),
        ),
      ).toBe(true);
    },
  );

  it("requires exactly 61 rounds, including for an empty input", () => {
    expect(validateContent(ROUNDS.slice(0, -1), DICTIONARY)).toContainEqual(
      expect.stringContaining("rule 1): expected 61 rounds, received 60"),
    );
    expect(
      validateContent([...ROUNDS, ...ROUNDS.slice(-1)], DICTIONARY),
    ).toContainEqual(
      expect.stringContaining("rule 1): expected 61 rounds, received 62"),
    );
    expect(validateContent([], DICTIONARY)).toContainEqual(
      expect.stringContaining("rule 1): expected 61 rounds, received 0"),
    );
  });

  it.each([
    {
      number: 41,
      introduces: ["sand", "lamp", "camp"],
      length: 4,
      expected: 54,
      actual: 53,
    },
    {
      number: 43,
      introduces: ["milk", "gift", "desk"],
      length: 5,
      expected: 16,
      actual: 15,
    },
  ])(
    "checks introduced counts for length $length",
    ({ number, introduces, length, expected, actual }) => {
      expect(
        validateContent(changeRound(number, { introduces }), DICTIONARY),
      ).toContain(
        `Round 61-ink-unk (rule 9): expected ${String(expected)} introduced words of length ${String(length)}, received ${String(actual)}`,
      );
    },
  );
});
