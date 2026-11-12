import { describe, expect, it } from "vitest";

import { createTapGuard } from "./tap-guard.ts";

/** A click that came from a pointer has a detail of 1 or more. */
const POINTER = 1;
/** A click from the keyboard or assistive technology has a detail of 0. */
const KEYBOARD = 0;

// What a whole gesture does (tap, drag, cancel, second pointer) is tested
// with real events in drag.test.ts; this file covers the click decision.

describe("the click of a pointer gesture", () => {
  it("is not an activation", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    expect(guard.clickActivates(tile, POINTER)).toBe(false);
  });

  it("is suppressed once per gesture", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    expect(guard.clickActivates(tile, POINTER)).toBe(false);
    guard.pointerDown(tile);
    expect(guard.clickActivates(tile, POINTER)).toBe(false);
  });

  it("stays suppressed when earlier gestures got no click", () => {
    // Chrome after a flicked drag: no click for the drag or for the next tap.
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    guard.pointerDown(tile);
    guard.pointerDown(tile);
    expect(guard.clickActivates(tile, POINTER)).toBe(false);
  });

  it("is tracked per tile", () => {
    const guard = createTapGuard<object>();
    const pressed = {};
    const other = {};
    guard.pointerDown(pressed);
    expect(guard.clickActivates(other, POINTER)).toBe(true);
    expect(guard.clickActivates(pressed, POINTER)).toBe(false);
  });
});

describe("a click that no pointer gesture preceded", () => {
  it("activates, with any detail", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    expect(guard.clickActivates(tile, KEYBOARD)).toBe(true);
    expect(guard.clickActivates(tile, POINTER)).toBe(true);
  });

  it("activates after a gesture whose own click was already consumed", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    expect(guard.clickActivates(tile, POINTER)).toBe(false);
    expect(guard.clickActivates(tile, POINTER)).toBe(true);
  });
});

describe("the keyboard", () => {
  it("activates after a pointer gesture that got no click", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    guard.keyDown(tile);
    expect(guard.clickActivates(tile, KEYBOARD)).toBe(true);
  });

  it("clears the mark with Enter or Space, whatever detail the click has", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    guard.keyDown(tile);
    expect(guard.clickActivates(tile, POINTER)).toBe(true);
  });

  it("gets through on detail 0 alone, and clears the mark", () => {
    const guard = createTapGuard<object>();
    const tile = {};
    guard.pointerDown(tile);
    expect(guard.clickActivates(tile, KEYBOARD)).toBe(true);
    expect(guard.clickActivates(tile, POINTER)).toBe(true);
  });
});
