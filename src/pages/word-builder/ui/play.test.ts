// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { query } from "../../../shared/dom.ts";
import { ROUNDS } from "../content/rounds.ts";
import type { Round } from "../content/types.ts";

// No pictures, no sound: the game must run silently (plan 3.2, 3.4).
vi.mock("../assets.ts", () => ({
  pictureUrl: () => undefined,
  clipUrl: () => undefined,
  MASCOT_URL: undefined,
}));
vi.mock("../audio/engine.ts", () => ({
  playClip: vi.fn(() => Promise.resolve(false)),
  preload: vi.fn(),
  stopAll: vi.fn(),
}));
vi.mock("../audio/sfx.ts", () => ({ sfx: vi.fn() }));

const FINGER = 1;
/** Longer than any sequence that follows one placement. */
const SEQUENCE_MS = 6000;

let teardown: () => void = () => undefined;

function firstRound(): Round {
  const round = ROUNDS[0];
  if (round === undefined) throw new Error("No rounds");
  return round;
}

/** A fresh copy of the play screen and the store, mounted on round 01. */
async function mountRound(): Promise<{
  readonly seenDragDemo: () => boolean;
}> {
  const { mountPlay } = await import("./play.ts");
  const store = await import("../game/store.ts");
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  teardown = mountPlay(root, { go: vi.fn() }, firstRound(), "guided");
  return { seenDragDemo: () => store.getProgress().seenDragDemo };
}

function tile(letter: string): HTMLButtonElement {
  return query(`button.tile[data-tile="${letter}"]`, HTMLButtonElement);
}

function demoIsOn(): boolean {
  return query(".demo", HTMLDivElement).classList.contains("is-on");
}

function phase(): string | null {
  return query(".screen--play", HTMLDivElement).getAttribute("data-phase");
}

function pointer(element: Element, type: string, x = 0): void {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: FINGER,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
    }),
  );
}

const savedAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  localStorage.clear();
  // An animation that finishes after its delay and duration, or on cancel.
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: (
      _keyframes: unknown,
      options: { readonly duration: number; readonly delay?: number },
    ) => {
      let finish: () => void = () => undefined;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const timer = setTimeout(finish, options.duration + (options.delay ?? 0));
      return {
        finished,
        cancel: () => {
          clearTimeout(timer);
          finish();
        },
      };
    },
  });
  // A laid-out stage, with the blank far from the tray.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element): DOMRect {
      return this.classList.contains("blank")
        ? new DOMRect(5000, 0, 176, 200)
        : new DOMRect(0, 0, 1024, 768);
    },
  );
});

afterEach(() => {
  teardown();
  teardown = () => undefined;
  if (savedAnimate === undefined) {
    Reflect.deleteProperty(Element.prototype, "animate");
  } else {
    Object.defineProperty(Element.prototype, "animate", savedAnimate);
  }
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the hand demo before the first placement", () => {
  it("runs when a first round opens", async () => {
    const game = await mountRound();
    expect(phase()).toBe("idle");
    expect(demoIsOn()).toBe(true);
    expect(game.seenDragDemo()).toBe(false);
  });

  it("is hidden while a tile is pressed", async () => {
    await mountRound();
    pointer(tile("m"), "pointerdown");
    expect(demoIsOn()).toBe(false);
  });

  it.each([
    [
      "pointercancel",
      () => {
        pointer(tile("m"), "pointercancel");
      },
    ],
    [
      "lostpointercapture",
      () => {
        pointer(tile("m"), "lostpointercapture");
      },
    ],
    ["window resize", () => window.dispatchEvent(new Event("resize"))],
    ["window blur", () => window.dispatchEvent(new Event("blur"))],
  ])("comes back after a press ended by %s", async (_name, cancel) => {
    const game = await mountRound();
    pointer(tile("m"), "pointerdown");
    cancel();
    expect(phase()).toBe("idle");
    expect(demoIsOn()).toBe(true);
    expect(game.seenDragDemo()).toBe(false);
  });

  it("comes back after a tile is let go away from the blank", async () => {
    const game = await mountRound();
    pointer(tile("m"), "pointerdown");
    pointer(tile("m"), "pointermove", 60);
    expect(demoIsOn()).toBe(false);
    pointer(tile("m"), "pointerup", 60);
    expect(phase()).toBe("idle");
    expect(demoIsOn()).toBe(true);
    expect(game.seenDragDemo()).toBe(false);
  });

  it("is hidden again by the next press, and comes back again", async () => {
    await mountRound();
    pointer(tile("m"), "pointerdown");
    pointer(tile("m"), "pointercancel");
    pointer(tile("p"), "pointerdown");
    expect(demoIsOn()).toBe(false);
    pointer(tile("p"), "pointercancel");
    expect(demoIsOn()).toBe(true);
  });

  it("ends for good with the first placement", async () => {
    const game = await mountRound();
    pointer(tile("m"), "pointerdown");
    pointer(tile("m"), "pointerup");
    expect(phase()).toBe("sounding");
    expect(game.seenDragDemo()).toBe(true);
    expect(demoIsOn()).toBe(false);

    await vi.advanceTimersByTimeAsync(SEQUENCE_MS);
    expect(phase()).toBe("idle");
    expect(demoIsOn()).toBe(false);

    // A cancelled press no longer brings it back.
    pointer(tile("p"), "pointerdown");
    pointer(tile("p"), "pointercancel");
    expect(demoIsOn()).toBe(false);
  });

  it("does not come back while a sequence is running", async () => {
    await mountRound();
    tile("m").click(); // a keyboard activation: sounding starts
    expect(phase()).toBe("sounding");
    pointer(tile("p"), "pointerdown");
    pointer(tile("p"), "pointercancel");
    window.dispatchEvent(new Event("resize"));
    expect(demoIsOn()).toBe(false);
  });
});
