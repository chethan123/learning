import { describe, expect, it } from "vitest";

import { ALL_WORDS, roundById } from "../content/derive.ts";
import { graphemesOf } from "../content/letter-sets.ts";
import { ROUNDS } from "../content/rounds.ts";
import type { FrameGroup } from "../content/types.ts";
import {
  blankIsWide,
  celebrationPose,
  celebrationStickerSize,
  frameScale,
  frameWidth,
  hopArc,
  isWide,
  mascotTop,
  scrollTarget,
  stickerRotation,
  stoneCentre,
  stripWidth,
  trayGap,
} from "./layout.ts";

function groupOf(roundId: string, index: number): FrameGroup {
  const group = roundById(roundId)?.groups[index];
  if (group === undefined)
    throw new Error(`No group ${roundId}/${String(index)}`);
  return group;
}

function widthOf(group: FrameGroup): number {
  return frameWidth(group, graphemesOf(group.rest));
}

describe("trail geometry", () => {
  it("puts stones every 190 px on a four-step zigzag", () => {
    expect(stoneCentre(0)).toEqual({ x: 200, y: 470 });
    expect(stoneCentre(1)).toEqual({ x: 390, y: 330 });
    expect(stoneCentre(2)).toEqual({ x: 580, y: 450 });
    expect(stoneCentre(3)).toEqual({ x: 770, y: 320 });
    expect(stoneCentre(4)).toEqual({ x: 960, y: 470 });
    expect(stoneCentre(60)).toEqual({ x: 11600, y: 470 });
  });

  it("rejects a negative index", () => {
    expect(() => stoneCentre(-1)).toThrow();
  });

  it("makes the strip wide enough to centre the last stone", () => {
    expect(stripWidth(ROUNDS.length)).toBe(12112);
    expect(stripWidth(1)).toBe(712);
  });

  it("centres a stone, in CSS px, within the scroll range", () => {
    // Stage 1024 wide: one design px is one CSS px.
    expect(scrollTarget(960, 1, 11088)).toBe(448);
    // The smallest supported viewport, 768 x 432.
    expect(scrollTarget(960, 0.5625, 6237)).toBe(252);
    // The first stones cannot be centred: the strip starts at 0.
    expect(scrollTarget(200, 1, 11088)).toBe(0);
    // The last stone sits exactly at the end of the range.
    expect(scrollTarget(11600, 1, 11088)).toBe(11088);
    expect(scrollTarget(11600, 1, 5000)).toBe(5000);
    expect(scrollTarget(960, 1, -3)).toBe(0);
  });

  it("stands the mascot 8 px above the halo of the current stone", () => {
    // Stone centre 470, radius 92, halo ring 16: halo top 362; bottom edge 354.
    expect(mascotTop(470, "current") + 112).toBe(354);
    // Above a finished stone: radius 66, top 404; bottom edge 396.
    expect(mascotTop(470, "done") + 112).toBe(396);
  });

  it("hops along an arc from the old stone to the new one", () => {
    const arc = hopArc({ x: -190, y: 140 }, 100, 4);
    expect(arc).toHaveLength(5);
    expect(arc[0]).toEqual({ x: -190, y: 140 });
    expect(arc[4]?.x).toBeCloseTo(0);
    expect(arc[4]?.y).toBeCloseTo(0);
    // Half way: on the straight line, lifted by the full height.
    expect(arc[2]).toEqual({ x: -95, y: 70 - 100 });
  });
});

describe("stickerRotation", () => {
  it("is the sum of the char codes modulo 7, minus 3", () => {
    // m 109 + a 97 + t 116 = 322; 322 % 7 = 0.
    expect(stickerRotation("mat")).toBe(-3);
    // s 115 + a 97 + t 116 = 328; 328 % 7 = 6.
    expect(stickerRotation("sat")).toBe(3);
    // c 99 + a 97 + t 116 = 312; 312 % 7 = 4.
    expect(stickerRotation("cat")).toBe(1);
  });

  it("stays between -3 and 3 degrees for every word", () => {
    for (const word of ALL_WORDS) {
      const turn = stickerRotation(word);
      expect(Number.isInteger(turn)).toBe(true);
      expect(turn).toBeGreaterThanOrEqual(-3);
      expect(turn).toBeLessThanOrEqual(3);
    }
  });
});

describe("frame and tray sizes", () => {
  it("knows one-letter from two-letter pieces", () => {
    expect(isWide("s")).toBe(false);
    expect(isWide("sh")).toBe(true);
    expect(isWide("fr")).toBe(true);
  });

  it("widens the blank when any tile of the group has two letters", () => {
    expect(blankIsWide(groupOf("01-at", 0))).toBe(false);
    // _og: fr d + g
    expect(blankIsWide(groupOf("44-og-um-ab", 0))).toBe(true);
    // _ab: cr + p pl (the two-letter extra counts too)
    expect(blankIsWide(groupOf("44-og-um-ab", 2))).toBe(true);
  });

  it("measures a frame: blank, cards and gaps", () => {
    // _at: 176 + 176 + 176 + 2 * 20
    expect(widthOf(groupOf("01-at", 0))).toBe(568);
    // _ock with one-letter tiles: 176 + o 176 + ck 240 + 2 * 20
    expect(widthOf(groupOf("49-ock", 0))).toBe(632);
    // _ant with pl: 240 + 3 * 176 + 3 * 20, the widest authored frame
    expect(widthOf(groupOf("43-ilk-ift-esk-ant", 3))).toBe(828);
  });

  it("never needs to shrink an authored frame", () => {
    const widths = ROUNDS.flatMap((round) => round.groups.map(widthOf));
    expect(Math.max(...widths)).toBe(828);
    for (const width of widths) expect(frameScale(width)).toBe(1);
  });

  it("shrinks a frame wider than 900 to fit", () => {
    expect(frameScale(900)).toBe(1);
    expect(frameScale(1000)).toBeCloseTo(0.9);
    expect(1200 * frameScale(1200)).toBeCloseTo(900);
  });

  it("closes the tray up for five positions", () => {
    expect(trayGap(2)).toBe(40);
    expect(trayGap(4)).toBe(40);
    expect(trayGap(5)).toBe(20);
  });
});

describe("celebration row", () => {
  it("sizes the stickers by the number of words", () => {
    expect(celebrationStickerSize(2)).toBe(232);
    expect(celebrationStickerSize(3)).toBe(232);
    expect(celebrationStickerSize(4)).toBe(196);
    expect(celebrationStickerSize(5)).toBe(160);
  });

  it("fits the widest row on the stage", () => {
    for (const count of [2, 3, 4, 5]) {
      const row = count * celebrationStickerSize(count) + (count - 1) * 24;
      expect(row).toBeLessThanOrEqual(1024 - 2 * 40);
    }
  });

  it("fans the stickers out and lifts the middle", () => {
    expect(celebrationPose(0, 3)).toEqual({ rotate: -5, rise: 0 });
    expect(celebrationPose(1, 3)).toEqual({ rotate: 0, rise: 28 });
    expect(celebrationPose(2, 3)).toEqual({ rotate: 5, rise: 0 });
    expect(celebrationPose(0, 2)).toEqual({ rotate: -5, rise: 0 });
    expect(celebrationPose(1, 2)).toEqual({ rotate: 5, rise: 0 });
    expect(celebrationPose(0, 1)).toEqual({ rotate: 0, rise: 0 });
  });
});
