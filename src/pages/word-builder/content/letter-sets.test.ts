import { describe, expect, it } from "vitest";

import {
  graphemesOf,
  requiredSet,
  soundId,
  soundsOfRest,
  soundsOfTile,
} from "./letter-sets.ts";

describe("letter sets and sounds", () => {
  it.each([
    {
      word: "mat",
      graphemes: ["m", "a", "t"],
      set: 1,
      tile: "m",
      tileSounds: ["m"],
      rest: "at",
      restSounds: ["a", "t"],
    },
    {
      word: "frog",
      graphemes: ["f", "r", "o", "g"],
      set: 9,
      tile: "fr",
      tileSounds: ["f", "r"],
      rest: "og",
      restSounds: ["o", "g"],
    },
    {
      word: "ship",
      graphemes: ["sh", "i", "p"],
      set: 12,
      tile: "sh",
      tileSounds: ["sh"],
      rest: "ip",
      restSounds: ["i", "p"],
    },
    {
      word: "sock",
      graphemes: ["s", "o", "ck"],
      set: 11,
      tile: "s",
      tileSounds: ["s"],
      rest: "ock",
      restSounds: ["o", "k"],
    },
    {
      word: "bell",
      graphemes: ["b", "e", "ll"],
      set: 10,
      tile: "b",
      tileSounds: ["b"],
      rest: "ell",
      restSounds: ["e", "l"],
    },
    {
      word: "lunch",
      graphemes: ["l", "u", "n", "ch"],
      set: 14,
      tile: "l",
      tileSounds: ["l"],
      rest: "unch",
      restSounds: ["u", "n", "ch"],
    },
    {
      word: "skunk",
      graphemes: ["s", "k", "u", "n", "k"],
      set: 15,
      tile: "sk",
      tileSounds: ["s", "k"],
      rest: "unk",
      restSounds: ["u", "n", "k"],
    },
    {
      word: "king",
      graphemes: ["k", "i", "ng"],
      set: 15,
      tile: "k",
      tileSounds: ["k"],
      rest: "ing",
      restSounds: ["i", "ng"],
    },
    {
      word: "pink",
      graphemes: ["p", "i", "n", "k"],
      set: 15,
      tile: "p",
      tileSounds: ["p"],
      rest: "ink",
      restSounds: ["i", "n", "k"],
    },
    {
      word: "box",
      graphemes: ["b", "o", "x"],
      set: 8,
      tile: "b",
      tileSounds: ["b"],
      rest: "ox",
      restSounds: ["o", "x"],
    },
  ])(
    "segments and sounds out $word at set $set",
    ({ word, graphemes, set, tile, tileSounds, rest, restSounds }) => {
      expect(graphemesOf(word)).toEqual(graphemes);
      expect(requiredSet(word)).toBe(set);
      expect(soundsOfTile(tile)).toEqual(tileSounds);
      expect(soundsOfRest(rest)).toEqual(restSounds);
    },
  );

  it.each([
    ["c", "k"],
    ["ck", "k"],
    ["ll", "l"],
    ["ss", "s"],
    ["sh", "sh"],
    ["ch", "ch"],
    ["th", "th"],
    ["ng", "ng"],
    ["x", "x"],
  ])("maps grapheme %s to clip %s", (grapheme, sound) => {
    expect(soundId(grapheme)).toBe(sound);
  });

  it("scans digraphs from left to right without grouping blends or nk", () => {
    expect(graphemesOf("llssckshthchngnkfr")).toEqual([
      "ll",
      "ss",
      "ck",
      "sh",
      "th",
      "ch",
      "ng",
      "n",
      "k",
      "f",
      "r",
    ]);
    expect(graphemesOf("")).toEqual([]);
    expect(requiredSet("milk")).toBe(9);
    expect(requiredSet("kiss")).toBe(10);
    expect(requiredSet("bath")).toBe(13);
    expect(soundsOfRest("iss")).toEqual(["i", "s"]);
    expect(soundsOfTile("c")).toEqual(["k"]);
  });

  it.each(["qat", "mat!", "Mat"])(
    "throws for unknown letters in %s",
    (word) => {
      expect(() => requiredSet(word)).toThrow(/Unknown grapheme/);
    },
  );
});
