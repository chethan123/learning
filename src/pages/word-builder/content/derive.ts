import { soundsOfRest, soundsOfTile } from "./letter-sets.ts";
import { ROUNDS } from "./rounds.ts";
import type { Clip, Round } from "./types.ts";

export function wordsOf(round: Round): readonly string[] {
  return round.groups.flatMap((group) =>
    group.winning.map((tile) => tile + group.rest),
  );
}

export const ALL_WORDS: readonly string[] = ROUNDS.flatMap(
  (round) => round.introduces,
);

export function clipsOf(round: Round): readonly Clip[] {
  const words = new Set(wordsOf(round));
  const sounds = new Set(
    round.groups.flatMap((group) => [
      ...[...group.winning, ...group.extras].flatMap(soundsOfTile),
      ...soundsOfRest(group.rest),
    ]),
  );
  return [
    ...Array.from(words, (id): Clip => ({ kind: "word", id })),
    ...Array.from(sounds, (id): Clip => ({ kind: "sound", id })),
  ];
}

export const ALL_SOUNDS: readonly string[] = [
  ...new Set(
    ROUNDS.flatMap(clipsOf)
      .filter((clip) => clip.kind === "sound")
      .map((clip) => clip.id),
  ),
].sort();

export function coverWord(round: Round): string {
  const word = round.introduces[0];
  if (word === undefined) {
    throw new Error(`Round ${round.id} has no introduced word for its cover`);
  }
  return word;
}

export function roundById(id: string): Round | undefined {
  return ROUNDS.find((round) => round.id === id);
}
