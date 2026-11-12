import { BLOCKLIST } from "./blocklist.ts";
import { wordsOf } from "./derive.ts";
import { graphemesOf, requiredSet } from "./letter-sets.ts";
import type { FrameGroup, Round } from "./types.ts";

const CONSONANT = /^[bcdfghjklmnprstvwxyz]$/;
const CONSONANT_PAIR = /^[bcdfghjklmnprstvwxyz]{2}$/;
const EXTRA_LETTER = /^[mstpfndgbhrlwjvzy]$/;
const REST = /^[aeiou][bcdfghjklmnprstvwxyz]+$/;

function isBlend(tile: string): boolean {
  return CONSONANT_PAIR.test(tile) && graphemesOf(tile).length === 2;
}

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

type Report = (rule: number, message: string) => void;

function validateCombination(word: string, round: Round, report: Report): void {
  try {
    const required = requiredSet(word);
    if (required > round.letterSet) {
      report(
        2,
        `"${word}" requires letter set ${String(required)}, above ${String(round.letterSet)}`,
      );
    }
  } catch (error) {
    report(
      2,
      error instanceof Error ? error.message : `Unknown letter in "${word}"`,
    );
  }
  if (BLOCKLIST.has(word)) report(7, `"${word}" is in the blocklist`);
}

function validateGroup(
  group: FrameGroup,
  round: Round,
  allWords: ReadonlySet<string>,
  dictionary: ReadonlySet<string>,
  report: Report,
): void {
  const { rest, winning, extras } = group;
  if (!REST.test(rest)) {
    report(
      3,
      `rest "${rest}" must be one vowel followed by consonant letters from the letter sets`,
    );
  }
  if (BLOCKLIST.has(rest)) report(7, `rest "${rest}" is in the blocklist`);
  if (winning.length === 0) report(4, `group _${rest} has no winning tile`);
  for (const tile of duplicates(winning)) {
    report(4, `group _${rest} repeats winning tile "${tile}"`);
  }
  for (const tile of winning) {
    if (!(
      CONSONANT.test(tile) ||
      tile === "sh" ||
      tile === "ch" ||
      isBlend(tile)
    )) {
      report(4, `group _${rest} has invalid winning tile "${tile}"`);
    }
    const word = tile + rest;
    validateCombination(word, round, report);
    if (word.length < 3 || word.length > 5) {
      report(5, `target "${word}" must have 3 to 5 letters`);
    }
    if (!dictionary.has(word))
      report(5, `target "${word}" is not in the dictionary`);
  }
  const tileCount = winning.length + extras.length;
  if (tileCount < 2 || tileCount > 5) {
    report(5, `group _${rest} has ${String(tileCount)} tiles; expected 2 to 5`);
  }
  const limit = winning.length === 1 ? 2 : 1;
  if (extras.length > limit) {
    report(
      8,
      `group _${rest} has ${String(extras.length)} extras; at most ${String(limit)} allowed`,
    );
  }
  if (round.number <= 10 && extras.length > 0) {
    report(8, `group _${rest} has extras in rounds 01-10`);
  }
  for (const tile of extras) {
    if (!(EXTRA_LETTER.test(tile) || isBlend(tile))) {
      report(8, `group _${rest} has invalid extra tile "${tile}"`);
    }
    if (winning.includes(tile)) {
      report(8, `group _${rest} extra "${tile}" is also a winning tile`);
    }
    if (tile.length === 2 && !winning.some((winner) => winner.length === 2)) {
      report(
        8,
        `group _${rest} has two-letter extra "${tile}" without a two-letter winning tile`,
      );
    }
    const word = tile + rest;
    validateCombination(word, round, report);
    if (allWords.has(word))
      report(8, `extra combination "${word}" is in ALL_WORDS`);
    if (dictionary.has(word))
      report(8, `extra combination "${word}" is in the dictionary`);
  }
}

export function validateContent(
  rounds: readonly Round[],
  dictionary: ReadonlySet<string>,
): readonly string[] {
  const errors: string[] = [];
  // Derive from the supplied rounds so fixtures and future content edits are validated too.
  const allWords = new Set(rounds.flatMap(wordsOf));
  const seenWords = new Set<string>();
  const seenIds = new Set<string>();
  const lastId = rounds.at(-1)?.id ?? "<missing round 01>";
  if (rounds.length !== 61) {
    errors.push(
      `Round ${lastId} (rule 1): expected 61 rounds, received ${String(rounds.length)}`,
    );
  }
  let previousSet = 0;
  for (const [index, round] of rounds.entries()) {
    const report: Report = (rule, message) => {
      errors.push(`Round ${round.id} (rule ${String(rule)}): ${message}`);
    };
    if (
      !Number.isInteger(round.number) ||
      round.number < 1 ||
      round.number > 61
    ) {
      report(
        1,
        `number ${String(round.number)} must be an integer from 1 to 61`,
      );
    }
    if (round.number !== index + 1) {
      report(1, `number ${String(round.number)} must be ${String(index + 1)}`);
    }
    const expectedId = `${String(round.number).padStart(2, "0")}-${round.groups.map((group) => group.rest).join("-")}`;
    if (round.id !== expectedId) report(1, `id must be "${expectedId}"`);
    if (seenIds.has(round.id)) report(1, "id is duplicated");
    seenIds.add(round.id);
    if (
      !Number.isInteger(round.letterSet) ||
      round.letterSet < 1 ||
      round.letterSet > 15
    ) {
      report(
        2,
        `letter set ${String(round.letterSet)} must be an integer from 1 to 15`,
      );
    }
    if (round.letterSet < previousSet)
      report(2, "letter set decreases from the previous round");
    previousSet = round.letterSet;
    for (const rest of duplicates(round.groups.map((group) => group.rest))) {
      report(3, `rest "${rest}" appears more than once`);
    }
    for (const group of round.groups) {
      validateGroup(group, round, allWords, dictionary, report);
    }
    const words = wordsOf(round);
    if (words.length < 2 || words.length > 5) {
      report(5, `has ${String(words.length)} target words; expected 2 to 5`);
    }
    for (const word of duplicates(words))
      report(5, `target "${word}" appears twice in the round`);
    const introductions = words.filter((word) => !seenWords.has(word));
    if (round.introduces.length === 0)
      report(6, "introduces must not be empty");
    if (
      round.introduces.length !== introductions.length ||
      round.introduces.some(
        (word, position) => word !== introductions[position],
      )
    ) {
      report(
        6,
        `introduces must equal ${JSON.stringify(introductions)} in wordsOf order`,
      );
    }
    for (const word of words) seenWords.add(word);
  }
  const introduced = rounds.flatMap((round) => round.introduces);
  for (const [length, expected] of new Map([
    [3, 87],
    [4, 54],
    [5, 16],
  ])) {
    const count = introduced.filter((word) => word.length === length).length;
    if (count !== expected) {
      errors.push(
        `Round ${lastId} (rule 9): expected ${String(expected)} introduced words of length ${String(length)}, received ${String(count)}`,
      );
    }
  }
  return errors;
}
