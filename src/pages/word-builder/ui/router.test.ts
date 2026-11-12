import { describe, expect, it } from "vitest";

import { ROUNDS } from "../content/rounds.ts";
import type { Round } from "../content/types.ts";
import {
  completeRound,
  EMPTY_PROGRESS,
  setUnlockAll,
} from "../game/progress.ts";
import { resolveRoute } from "./router.ts";

function roundAt(index: number): Round {
  const round = ROUNDS[index];
  if (round === undefined) throw new Error(`No round ${String(index)}`);
  return round;
}

const first = roundAt(0);
const second = roundAt(1);
const third = roundAt(2);
const REDIRECT = { redirect: "#/" };
const firstDone = completeRound(EMPTY_PROGRESS, first);

describe("resolveRoute", () => {
  it("shows the trail for the home hash and for no hash", () => {
    for (const hash of ["#/", "#", ""]) {
      expect(resolveRoute(hash, EMPTY_PROGRESS)).toEqual({ screen: "trail" });
    }
  });

  it("resolves the sticker book and the grown-ups page", () => {
    expect(resolveRoute("#/stickers", EMPTY_PROGRESS)).toEqual({
      screen: "stickers",
    });
    expect(resolveRoute("#/grown-ups", EMPTY_PROGRESS)).toEqual({
      screen: "grown-ups",
    });
  });

  it("opens the current round as a guided round", () => {
    expect(resolveRoute(`#/play/${first.id}`, EMPTY_PROGRESS)).toEqual({
      screen: "play",
      round: first,
    });
    expect(resolveRoute(`#/play/${second.id}`, firstDone)).toEqual({
      screen: "play",
      round: second,
    });
  });

  it("refuses a guided round that is locked", () => {
    expect(resolveRoute(`#/play/${second.id}`, EMPTY_PROGRESS)).toEqual(
      REDIRECT,
    );
    expect(resolveRoute(`#/play/${third.id}`, firstDone)).toEqual(REDIRECT);
  });

  it("opens any unfinished round as guided when everything is unlocked", () => {
    const unlocked = setUnlockAll(firstDone, true);
    expect(resolveRoute(`#/play/${third.id}`, unlocked)).toEqual({
      screen: "play",
      round: third,
    });
  });

  it("never plays a finished round as guided again", () => {
    expect(resolveRoute(`#/play/${first.id}`, firstDone)).toEqual(REDIRECT);
    expect(
      resolveRoute(`#/play/${first.id}`, setUnlockAll(firstDone, true)),
    ).toEqual(REDIRECT);
  });

  it("opens free play only for a finished round", () => {
    expect(resolveRoute(`#/free/${first.id}`, firstDone)).toEqual({
      screen: "free",
      round: first,
    });
    expect(resolveRoute(`#/free/${first.id}`, EMPTY_PROGRESS)).toEqual(
      REDIRECT,
    );
    expect(resolveRoute(`#/free/${second.id}`, firstDone)).toEqual(REDIRECT);
    expect(
      resolveRoute(`#/free/${second.id}`, setUnlockAll(firstDone, true)),
    ).toEqual(REDIRECT);
  });

  it("redirects unknown round ids", () => {
    expect(resolveRoute("#/play/99-zz", EMPTY_PROGRESS)).toEqual(REDIRECT);
    expect(resolveRoute("#/free/99-zz", firstDone)).toEqual(REDIRECT);
  });

  it.each([
    "#/play",
    "#/play/",
    "#/free/",
    `#/play/${first.id}/`,
    `#/play/${first.id}/extra`,
    `#/play/${first.id.toUpperCase()}X`,
    `#/PLAY/${first.id}`,
    `#play/${first.id}`,
    `/play/${first.id}`,
    "#/stickers/",
    "#/stickers/1",
    "#/grown-ups/x",
    "#/grownups",
    "#/trail",
    "#//",
    "#/ ",
    "#stickers",
    "stickers",
    "#/%",
  ])("redirects the malformed hash %j", (hash) => {
    expect(resolveRoute(hash, setUnlockAll(firstDone, true))).toEqual(REDIRECT);
  });
});
