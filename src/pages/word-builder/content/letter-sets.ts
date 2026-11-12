import type { Tile } from "./types.ts";

const GRAPHEME_SETS = new Map<string, number>(
  [
    ["a", "m", "s", "t", "p"],
    ["f", "i", "n"],
    ["o", "d", "c"],
    ["u", "g", "b"],
    ["e"],
    ["k", "h", "r"],
    ["l", "w", "j"],
    ["y", "x", "v", "z"],
    [],
    ["ll", "ss"],
    ["ck"],
    ["sh"],
    ["th"],
    ["ch"],
    ["ng"],
  ].flatMap((graphemes, index) =>
    graphemes.map((grapheme): [string, number] => [grapheme, index + 1]),
  ),
);

const DIGRAPHS = new Set(["ll", "ss", "ck", "sh", "th", "ch", "ng"]);
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export function graphemesOf(text: string): readonly string[] {
  const graphemes: string[] = [];
  for (let index = 0; index < text.length;) {
    const pair = text.slice(index, index + 2);
    const grapheme = DIGRAPHS.has(pair) ? pair : text.slice(index, index + 1);
    graphemes.push(grapheme);
    index += grapheme.length;
  }
  return graphemes;
}

export function requiredSet(word: string): number {
  let required = word.includes("nk") ? 15 : 0;
  let previousConsonant = false;
  for (const grapheme of graphemesOf(word)) {
    const set = GRAPHEME_SETS.get(grapheme);
    if (set === undefined) {
      throw new Error(`Unknown grapheme "${grapheme}" in "${word}"`);
    }
    const consonant = !VOWELS.has(grapheme);
    required = Math.max(required, set, previousConsonant && consonant ? 9 : 0);
    previousConsonant = consonant;
  }
  return required;
}

/** Clip ids share recordings for equivalent graphemes. */
export function soundId(grapheme: string): string {
  switch (grapheme) {
    case "c":
    case "ck":
      return "k";
    case "ll":
      return "l";
    case "ss":
      return "s";
    default:
      return grapheme;
  }
}

export function soundsOfTile(tile: Tile): readonly string[] {
  return graphemesOf(tile).map(soundId);
}

export function soundsOfRest(rest: string): readonly string[] {
  return graphemesOf(rest).map(soundId);
}
