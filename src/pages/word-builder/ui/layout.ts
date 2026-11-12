/**
 * Pure geometry of the design stage (plan 3.1, 3.3). Every number is in
 * design px on the 1024 x 768 stage; CSS multiplies it by --u.
 */
import type { FrameGroup } from "../content/types.ts";

export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 768;

export interface Point {
  readonly x: number;
  readonly y: number;
}

const STONE_FIRST_X = 200;
const STONE_STEP_X = 190;
const STONE_YS: readonly number[] = [470, 330, 450, 320];

/** Centre of stone `index` (0-based) on the trail strip. */
export function stoneCentre(index: number): Point {
  const y = STONE_YS[index % STONE_YS.length];
  if (y === undefined || index < 0) {
    throw new Error(`No stone at index ${String(index)}`);
  }
  return { x: STONE_FIRST_X + STONE_STEP_X * index, y };
}

/** Width of the strip, so that the last stone can be centred. */
export function stripWidth(stoneCount: number): number {
  return stoneCentre(Math.max(stoneCount - 1, 0)).x + STAGE_WIDTH / 2;
}

/**
 * scrollLeft in CSS px that centres design position `x`, where `u` is the
 * stage width / 1024, clamped to the scroll range.
 */
export function scrollTarget(x: number, u: number, maxScroll: number): number {
  const wanted = (x - STAGE_WIDTH / 2) * u;
  return Math.min(Math.max(wanted, 0), Math.max(maxScroll, 0));
}

export const STONE_SIZE: Readonly<
  Record<"done" | "current" | "locked", number>
> = { done: 132, current: 184, locked: 116 };
export const HALO_RING = 16;
export const MASCOT_SIZE = 112;
const MASCOT_GAP = 8;

/**
 * Top of the mascot above a stone centred at `y`: its bottom edge sits 8 px
 * above the halo of a current stone, or above the stone itself otherwise.
 */
export function mascotTop(y: number, state: "done" | "current"): number {
  const reach =
    state === "current"
      ? STONE_SIZE.current / 2 + HALO_RING
      : STONE_SIZE.done / 2;
  return y - reach - MASCOT_GAP - MASCOT_SIZE;
}

/**
 * Offsets of a hop that ends at (0, 0), as `steps + 1` points along a
 * parabola that starts at `from` and rises `height` above the straight line.
 */
export function hopArc(
  from: Point,
  height: number,
  steps: number,
): readonly Point[] {
  const points: Point[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    points.push({
      x: from.x * (1 - t),
      y: from.y * (1 - t) - height * 4 * t * (1 - t),
    });
  }
  return points;
}

/** Degrees a sticker is turned in the sticker book: -3 to 3, fixed per word. */
export function stickerRotation(word: string): number {
  let sum = 0;
  for (let index = 0; index < word.length; index += 1) {
    sum += word.charCodeAt(index);
  }
  return (sum % 7) - 3;
}

export const FRAME_GAP = 20;
const FRAME_MAX_WIDTH = 900;
const CARD_WIDTH = 176;
const CARD_WIDTH_WIDE = 240;

/** True when a tile or card shows two letters and takes the wide size. */
export function isWide(text: string): boolean {
  return text.length > 1;
}

/** The blank is wide for the whole group if any of its tiles has two letters. */
export function blankIsWide(group: FrameGroup): boolean {
  return [...group.winning, ...group.extras].some(isWide);
}

/** Width of the frame: the blank, one card per grapheme of the rest, gaps. */
export function frameWidth(
  group: FrameGroup,
  restGraphemes: readonly string[],
): number {
  const blank = blankIsWide(group) ? CARD_WIDTH_WIDE : CARD_WIDTH;
  const cards = restGraphemes.reduce(
    (sum, grapheme) => sum + (isWide(grapheme) ? CARD_WIDTH_WIDE : CARD_WIDTH),
    0,
  );
  return blank + cards + FRAME_GAP * restGraphemes.length;
}

/** Uniform scale that keeps a frame within 900 design px (1 when it fits). */
export function frameScale(width: number): number {
  return width > FRAME_MAX_WIDTH ? FRAME_MAX_WIDTH / width : 1;
}

/** Gap between tray positions: 40 for up to four, 20 for five. */
export function trayGap(positionCount: number): number {
  return positionCount <= 4 ? 40 : 20;
}

/** Size of one sticker on the celebration row. */
export function celebrationStickerSize(wordCount: number): number {
  if (wordCount <= 3) return 232;
  return wordCount === 4 ? 196 : 160;
}

/** Tilt and lift of sticker `index` of `count` on the celebration row. */
export function celebrationPose(
  index: number,
  count: number,
): { readonly rotate: number; readonly rise: number } {
  const middle = (count - 1) / 2;
  if (middle === 0) return { rotate: 0, rise: 0 };
  const offset = (index - middle) / middle; // -1 at the left end, 1 at the right
  return { rotate: offset * 5, rise: (1 - Math.abs(offset)) * 28 };
}
