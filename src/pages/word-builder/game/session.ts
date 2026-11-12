import { wordsOf } from "../content/derive.ts";
import type { FrameGroup, Round, Tile } from "../content/types.ts";

export type Mode = "guided" | "free";

export interface Session {
  readonly round: Round;
  readonly mode: Mode;
  readonly groupIndex: number;
  /** Guided: target words of this round found so far, in order found. Free: always empty. */
  readonly found: readonly string[];
  /** Guided: misses in the current group since the last found word. Free: always 0. */
  readonly misses: number;
}

export type Outcome =
  | {
      readonly kind: "found"; // guided only
      readonly word: string;
      /** Index of the word's goal slot, i.e. its index in wordsOf(round). */
      readonly slot: number;
      readonly groupDone: boolean;
      readonly roundDone: boolean;
    }
  | { readonly kind: "shown"; readonly word: string } // free play only
  | { readonly kind: "miss" };

function compareTiles(a: Tile, b: Tile): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function groupWords(group: FrameGroup): readonly string[] {
  return group.winning.map((tile) => tile + group.rest);
}

function groupAt(round: Round, index: number): FrameGroup {
  const group = round.groups[index];
  if (group === undefined) {
    throw new Error(`Round ${round.id} has no group ${String(index)}`);
  }
  return group;
}

/**
 * Guided: `alreadyFound` (default none) are words of this round found in an
 * earlier visit; words not in the round are ignored; groupIndex is the first
 * group with a word still to find. Throws if every word is already found.
 * Free: `alreadyFound` is ignored; groupIndex 0.
 */
export function startSession(
  round: Round,
  mode: Mode,
  alreadyFound: readonly string[] = [],
): Session {
  if (mode === "free") {
    return { round, mode, groupIndex: 0, found: [], misses: 0 };
  }
  const words = new Set(wordsOf(round));
  const found = [...new Set(alreadyFound.filter((word) => words.has(word)))];
  const groupIndex = round.groups.findIndex((group) =>
    groupWords(group).some((word) => !found.includes(word)),
  );
  if (groupIndex < 0) {
    throw new Error(`Round ${round.id} has no word left to find`);
  }
  return { round, mode, groupIndex, found, misses: 0 };
}

export function currentGroup(session: Session): FrameGroup {
  return groupAt(session.round, session.groupIndex);
}

/** Every tile of the current group (winning and extras), alphabetical. Fixed for the group. */
export function trayPositions(session: Session): readonly Tile[] {
  const group = currentGroup(session);
  return [...group.winning, ...group.extras].sort(compareTiles);
}

/**
 * Tiles that can be placed now, alphabetical. Guided: winning tiles whose word
 * is not yet found, plus extras. Free: equal to trayPositions.
 */
export function tray(session: Session): readonly Tile[] {
  if (session.mode === "free") return trayPositions(session);
  const group = currentGroup(session);
  const open = group.winning.filter(
    (tile) => !session.found.includes(tile + group.rest),
  );
  return [...open, ...group.extras].sort(compareTiles);
}

/** Throws if the tile is not in tray(session). */
export function place(
  session: Session,
  tile: Tile,
): { readonly session: Session; readonly outcome: Outcome } {
  if (!tray(session).includes(tile)) {
    throw new Error(`Tile "${tile}" is not in the tray`);
  }
  const group = currentGroup(session);
  const winning = group.winning.includes(tile);
  const word = tile + group.rest;

  if (session.mode === "free") {
    return {
      session,
      outcome: winning ? { kind: "shown", word } : { kind: "miss" },
    };
  }
  if (!winning) {
    return {
      session: { ...session, misses: session.misses + 1 },
      outcome: { kind: "miss" },
    };
  }
  const slot = wordsOf(session.round).indexOf(word);
  if (slot < 0) {
    throw new Error(`Word "${word}" is not a target of ${session.round.id}`);
  }
  const found = [...session.found, word];
  return {
    session: { ...session, found, misses: 0 },
    outcome: {
      kind: "found",
      word,
      slot,
      groupDone: groupWords(group).every((w) => found.includes(w)),
      roundDone: wordsOf(session.round).every((w) => found.includes(w)),
    },
  };
}

/**
 * Guided: throws if the current group still has an unfound word; otherwise
 * moves to the next later group that has an unfound word (skipping groups
 * already fully found) and resets misses; throws if there is none.
 * Free: next group, wrapping.
 */
export function nextGroup(session: Session): Session {
  const groups = session.round.groups;
  if (session.mode === "free") {
    return {
      ...session,
      groupIndex: (session.groupIndex + 1) % groups.length,
    };
  }
  const hasOpenWord = (group: FrameGroup): boolean =>
    groupWords(group).some((word) => !session.found.includes(word));
  if (hasOpenWord(currentGroup(session))) {
    throw new Error("The current group still has words to find");
  }
  const offset = groups
    .slice(session.groupIndex + 1)
    .findIndex((group) => hasOpenWord(group));
  if (offset < 0) {
    throw new Error("There is no later group with a word to find");
  }
  return { ...session, groupIndex: session.groupIndex + 1 + offset, misses: 0 };
}

/**
 * Guided, misses >= 2: the alphabetically first winning tile in tray(session).
 * Otherwise undefined.
 */
export function hintTile(session: Session): Tile | undefined {
  if (session.mode !== "guided" || session.misses < 2) return undefined;
  const winning = currentGroup(session).winning;
  return tray(session).find((tile) => winning.includes(tile));
}
