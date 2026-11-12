// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { h } from "../../../shared/dom.ts";
import { createTileGestures, type TileGestures } from "./drag.ts";

const GLIDE_MS = 250;
/** Further than the 24 px threshold: the tile is dragged. */
const FAR = 30;

const FINGER = 1;
const SECOND_FINGER = 2;

let gestures: TileGestures;
let tile: HTMLButtonElement;
let other: HTMLButtonElement;
let canPlace: boolean;
/** Where the blank is: out of reach unless a test moves it. */
let target: DOMRect;
const onPress = vi.fn();
const onActivate = vi.fn();
const onDrop = vi.fn();
const onAbort = vi.fn();
const savedAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);

function pointer(
  element: Element,
  type: string,
  pointerId: number,
  x = 0,
  init: PointerEventInit = {},
): void {
  element.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId,
      pointerType: "touch",
      isPrimary: true,
      clientX: x,
      ...init,
    }),
  );
}

/** The click a browser sends after a pointer gesture (detail 1) or a key (0). */
function click(element: Element, detail = 1): void {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
}

function key(element: Element, name: string): void {
  element.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: name }),
  );
  click(element, 0);
}

function tap(element: Element, browserSendsClick: boolean): void {
  pointer(element, "pointerdown", FINGER);
  pointer(element, "pointerup", FINGER);
  if (browserSendsClick) click(element);
}

/** A drag released where the tile is not within reach of the blank. */
function dragAway(element: Element, browserSendsClick: boolean): void {
  pointer(element, "pointerdown", FINGER);
  pointer(element, "pointermove", FINGER, FAR);
  pointer(element, "pointerup", FINGER, FAR);
  if (browserSendsClick) click(element);
}

function placements(): number {
  return onActivate.mock.calls.length + onDrop.mock.calls.length;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  canPlace = true;
  target = new DOMRect(5000, 0, 100, 100);
  tile = h("button", { class: "tile", type: "button" }, "m");
  other = h("button", { class: "tile", type: "button" }, "p");
  const tray = h("div", {}, tile, other);
  document.body.replaceChildren(tray);

  // An animation that finishes after its duration, or when cancelled.
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value: (_keyframes: unknown, options: { readonly duration: number }) => {
      let finish: () => void = () => undefined;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const timer = setTimeout(finish, options.duration);
      return {
        finished,
        cancel: () => {
          clearTimeout(timer);
          finish();
        },
      };
    },
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, 100, 100),
  );

  gestures = createTileGestures(tray, ".tile", {
    canPlace: () => canPlace,
    target: () => target,
    onPress,
    onActivate,
    onDrop,
    onAbort,
    onNear: () => undefined,
  });
});

afterEach(() => {
  gestures.destroy();
  if (savedAnimate === undefined) {
    Reflect.deleteProperty(Element.prototype, "animate");
  } else {
    Object.defineProperty(Element.prototype, "animate", savedAnimate);
  }
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a tap", () => {
  it.each([true, false])(
    "places once (browser sends its click: %s)",
    (browserSendsClick) => {
      tap(tile, browserSendsClick);
      expect(onActivate).toHaveBeenCalledExactlyOnceWith(tile);
      expect(placements()).toBe(1);
      expect(onAbort).not.toHaveBeenCalled();
    },
  );

  it("places at pointerup, before any click", () => {
    pointer(tile, "pointerdown", FINGER);
    expect(placements()).toBe(0);
    pointer(tile, "pointerup", FINGER);
    expect(placements()).toBe(1);
  });

  it("places once as a mouse click: pointerdown, pointerup, click", () => {
    const mouse: PointerEventInit = { pointerType: "mouse", button: 0 };
    pointer(tile, "pointerdown", FINGER, 0, mouse);
    pointer(tile, "pointerup", FINGER, 0, mouse);
    click(tile);
    expect(placements()).toBe(1);
  });

  it("still counts when the pointer wobbled less than 24 px", () => {
    pointer(tile, "pointerdown", FINGER);
    pointer(tile, "pointermove", FINGER, 20);
    pointer(tile, "pointerup", FINGER, 20);
    click(tile);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(tile.classList.contains("is-dragging")).toBe(false);
  });

  it("places each time, whatever the browser does with the clicks", () => {
    tap(tile, true);
    tap(tile, false);
    tap(tile, false);
    tap(tile, true);
    expect(placements()).toBe(4);
  });
});

describe("a drag", () => {
  it("drops the tile once when released within reach of the blank", () => {
    target = new DOMRect(0, 0, 100, 100);
    dragAway(tile, true);
    expect(onDrop).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
    expect(tile.classList.contains("is-dragging")).toBe(false);
  });

  it("places nothing when released out of reach, click or no click", async () => {
    dragAway(tile, true);
    dragAway(tile, false);
    expect(placements()).toBe(0);
    expect(onAbort).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(GLIDE_MS);
    expect(tile.classList.contains("is-dragging")).toBe(false);
    expect(tile.style.transform).toBe("");
  });

  it("does not swallow a quick tap when the browser sent no click for either", () => {
    // Chrome after a flicked drag: no click for the drag, none for the tap.
    dragAway(tile, false);
    tap(tile, false);
    expect(placements()).toBe(1);
  });

  it("is followed by a tap that places once, clicks and all", async () => {
    dragAway(tile, true);
    await vi.advanceTimersByTimeAsync(GLIDE_MS);
    tap(tile, true);
    expect(placements()).toBe(1);
  });
});

describe("the keyboard and assistive technology", () => {
  it.each(["Enter", " "])("places once with the key %j", (name) => {
    key(tile, name);
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(tile);
  });

  it.each([true, false])(
    "places once after a drag (the drag got a click: %s)",
    (browserSendsClick) => {
      dragAway(tile, browserSendsClick);
      key(tile, "Enter");
      expect(placements()).toBe(1);
    },
  );

  it("places on a click that no pointer gesture preceded", () => {
    click(tile, 0);
    click(other, 1);
    expect(placements()).toBe(2);
  });

  it("does not place while placements are closed", () => {
    canPlace = false;
    key(tile, "Enter");
    expect(placements()).toBe(0);
  });
});

describe("a cancelled gesture", () => {
  const cancellations: readonly (readonly [string, () => void])[] = [
    ["window resize", () => window.dispatchEvent(new Event("resize"))],
    ["window blur", () => window.dispatchEvent(new Event("blur"))],
    [
      "pointercancel",
      () => {
        pointer(tile, "pointercancel", FINGER);
      },
    ],
    [
      "lostpointercapture",
      () => {
        pointer(tile, "lostpointercapture", FINGER);
      },
    ],
  ];

  it.each(cancellations)(
    "%s during a press: the pointerup and its click place nothing",
    (_name, cancel) => {
      pointer(tile, "pointerdown", FINGER);
      cancel();
      expect(gestures.active).toBe(false);
      pointer(tile, "pointerup", FINGER);
      click(tile);
      expect(placements()).toBe(0);
      expect(onAbort).toHaveBeenCalledExactlyOnceWith(tile);
    },
  );

  it.each(cancellations)(
    "%s during a drag: the tile glides back and nothing is placed",
    async (_name, cancel) => {
      target = new DOMRect(0, 0, 100, 100); // even within reach of the blank
      pointer(tile, "pointerdown", FINGER);
      pointer(tile, "pointermove", FINGER, FAR);
      expect(tile.classList.contains("is-dragging")).toBe(true);
      cancel();
      pointer(tile, "pointermove", FINGER, FAR * 2);
      pointer(tile, "pointerup", FINGER, FAR * 2);
      click(tile);
      expect(placements()).toBe(0);
      expect(onAbort).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(GLIDE_MS);
      expect(tile.classList.contains("is-dragging")).toBe(false);
      expect(tile.style.transform).toBe("");
    },
  );

  it("is cancelled only once", () => {
    pointer(tile, "pointerdown", FINGER);
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("blur"));
    pointer(tile, "pointercancel", FINGER);
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it("does not stop the next tap or the keyboard", () => {
    pointer(tile, "pointerdown", FINGER);
    window.dispatchEvent(new Event("resize"));
    pointer(tile, "pointerup", FINGER);
    click(tile);
    tap(tile, true);
    expect(placements()).toBe(1);
    key(tile, "Enter");
    expect(placements()).toBe(2);
  });

  it("does nothing when no gesture is in progress", () => {
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("blur"));
    pointer(tile, "pointercancel", FINGER);
    expect(onAbort).not.toHaveBeenCalled();
    tap(tile, true);
    expect(placements()).toBe(1);
  });
});

describe("an ignored gesture", () => {
  it("of a second pointer places nothing, during or after the first", () => {
    pointer(tile, "pointerdown", FINGER);
    pointer(other, "pointerdown", SECOND_FINGER);
    pointer(tile, "pointermove", FINGER, FAR);
    pointer(tile, "pointerup", FINGER, FAR);
    click(tile);
    pointer(other, "pointerup", SECOND_FINGER);
    click(other);
    expect(placements()).toBe(0);
    expect(onPress).toHaveBeenCalledExactlyOnceWith(tile);
  });

  it("of a second pointer does not disturb the first one's tap", () => {
    pointer(tile, "pointerdown", FINGER);
    pointer(other, "pointerdown", SECOND_FINGER);
    pointer(other, "pointerup", SECOND_FINGER);
    click(other);
    pointer(tile, "pointerup", FINGER);
    click(tile);
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(tile);
  });

  it("that began while placements were closed places nothing later", () => {
    canPlace = false;
    pointer(tile, "pointerdown", FINGER);
    canPlace = true;
    pointer(tile, "pointerup", FINGER);
    click(tile);
    expect(placements()).toBe(0);
    expect(onPress).not.toHaveBeenCalled();
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("of another mouse button places nothing", () => {
    const right: PointerEventInit = { pointerType: "mouse", button: 2 };
    pointer(tile, "pointerdown", FINGER, 0, right);
    pointer(tile, "pointerup", FINGER, 0, right);
    click(tile);
    expect(placements()).toBe(0);
  });

  it("leaves the tile to the next real tap", () => {
    pointer(tile, "pointerdown", FINGER);
    pointer(other, "pointerdown", SECOND_FINGER);
    pointer(other, "pointerup", SECOND_FINGER);
    pointer(tile, "pointercancel", FINGER);
    tap(other, true);
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(other);
  });
});

describe("a tile that is gliding back", () => {
  it("loses its drag styling at once when it is pressed again", () => {
    dragAway(tile, false);
    expect(tile.classList.contains("is-dragging")).toBe(true);
    vi.advanceTimersByTime(40);
    pointer(tile, "pointerdown", FINGER);
    expect(tile.classList.contains("is-dragging")).toBe(false);
    expect(tile.style.transform).toBe("");
  });

  it("is clean after a quick tap, which places once", async () => {
    dragAway(tile, true);
    await vi.advanceTimersByTimeAsync(40);
    tap(tile, true);
    await vi.advanceTimersByTimeAsync(GLIDE_MS * 2);
    expect(placements()).toBe(1);
    expect(tile.classList.contains("is-dragging")).toBe(false);
  });

  it("loses its drag styling when another tile is pressed", () => {
    dragAway(tile, false);
    pointer(other, "pointerdown", FINGER);
    expect(tile.classList.contains("is-dragging")).toBe(false);
  });

  it("can be dragged again without the old glide interfering", async () => {
    dragAway(tile, false);
    await vi.advanceTimersByTimeAsync(40);
    pointer(tile, "pointerdown", FINGER);
    pointer(tile, "pointermove", FINGER, FAR);
    // The first glide's own 250 ms pass while the tile is held.
    await vi.advanceTimersByTimeAsync(GLIDE_MS);
    expect(tile.classList.contains("is-dragging")).toBe(true);
    expect(tile.style.transform).not.toBe("");
    pointer(tile, "pointerup", FINGER, FAR);
    await vi.advanceTimersByTimeAsync(GLIDE_MS);
    expect(tile.classList.contains("is-dragging")).toBe(false);
  });

  it("keeps gliding when the press is an ignored one", () => {
    dragAway(tile, false);
    canPlace = false;
    pointer(tile, "pointerdown", FINGER);
    expect(tile.classList.contains("is-dragging")).toBe(true);
  });
});

describe("what the host is told", () => {
  it("is one outcome for every accepted press", async () => {
    target = new DOMRect(0, 0, 100, 100);
    tap(tile, true); // activate
    dragAway(tile, true); // drop: the blank is within reach
    target = new DOMRect(5000, 0, 100, 100);
    dragAway(tile, true); // abort
    await vi.advanceTimersByTimeAsync(GLIDE_MS);
    pointer(tile, "pointerdown", FINGER);
    pointer(tile, "pointercancel", FINGER); // abort
    expect(onPress).toHaveBeenCalledTimes(4);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledTimes(2);
  });

  it("is an abort when placements closed during the press", () => {
    pointer(tile, "pointerdown", FINGER);
    canPlace = false;
    pointer(tile, "pointerup", FINGER);
    click(tile);
    expect(placements()).toBe(0);
    expect(onAbort).toHaveBeenCalledOnce();
  });
});

describe("destroy", () => {
  it("removes an active drag at once and stops listening", () => {
    pointer(tile, "pointerdown", FINGER);
    pointer(tile, "pointermove", FINGER, FAR);
    gestures.destroy();
    expect(gestures.active).toBe(false);
    expect(tile.classList.contains("is-dragging")).toBe(false);
    expect(tile.style.transform).toBe("");
    tap(other, true);
    click(other, 0);
    expect(placements()).toBe(0);
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("removes the styling of a tile that is gliding back", () => {
    dragAway(tile, false);
    gestures.destroy();
    expect(tile.classList.contains("is-dragging")).toBe(false);
  });
});
