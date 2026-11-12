/** A movable tile: one letter, a digraph ("sh", "ch") or a two-letter blend ("fr"). */
export type Tile = string;

export interface FrameGroup {
  /** Fixed letters shown after the blank, from the vowel on: "at", "ock", "unch". */
  readonly rest: string;
  /** Tiles that complete a target word in this group. At least one. */
  readonly winning: readonly Tile[];
  /** Tiles that form nothing (docs/word-builder/PLAN.md section 4.3). */
  readonly extras: readonly Tile[];
}

export interface Round {
  /** e.g. "09-at-ap". */
  readonly id: string;
  /** 1-based position on the trail. */
  readonly number: number;
  readonly letterSet: number;
  readonly groups: readonly FrameGroup[];
  /** Target words that appear for the first time in this round. At least one. */
  readonly introduces: readonly string[];
}

export type ClipKind = "word" | "sound";

export interface Clip {
  readonly kind: ClipKind;
  /** A word, or a sound id from soundId(). */
  readonly id: string;
}
