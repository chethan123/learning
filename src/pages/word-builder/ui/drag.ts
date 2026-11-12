/**
 * Tile activation and drag (plan 3.3, "Placing a tile"). This module knows
 * nothing about the game: the host says when a placement may start and where
 * the drop target is, and is told about a press, an activation or a drop.
 *
 * A tile is activated when a pointer is released on it without having moved
 * more than 24 CSS px, or by a `click` that no pointer gesture preceded
 * (keyboard, assistive technology). Past 24 CSS px the tile follows the
 * pointer, and releasing it close enough to the target is a drop.
 *
 * One pointer gesture is accepted at a time. A gesture that is ignored (a
 * second pointer, a press outside `canPlace`) or cancelled (pointercancel,
 * lost capture, window blur or resize) does nothing when its pointer is
 * released, and tap-guard.ts keeps the `click` of any pointer gesture from
 * placing a tile.
 *
 * After `onPress` the host hears exactly one of `onActivate`, `onDrop` or
 * `onAbort`, unless the gestures are destroyed first.
 */
import { EASE_OUT, reducedMotion } from "./motion.ts";
import { createScope } from "./scope.ts";
import { createTapGuard } from "./tap-guard.ts";

const DRAG_THRESHOLD_PX = 24;
const DROP_REACH = 1.25;
const GLIDE_BACK_MS = 250;
const DRAG_SCALE = 1.08;

export interface TileGestureHost {
  /** True while a placement may start (the play screen is idle). */
  readonly canPlace: () => boolean;
  /** Viewport rect of the drop target (the blank). */
  readonly target: () => DOMRect;
  /** A pointer went down on a tile and was accepted: a tap or a drag begins. */
  readonly onPress: (tile: HTMLButtonElement) => void;
  /** The tile was activated: a tap, a mouse click, the keyboard. */
  readonly onActivate: (tile: HTMLButtonElement) => void;
  /** The tile was dropped on the target; `from` is where it was let go. */
  readonly onDrop: (tile: HTMLButtonElement, from: DOMRect) => void;
  /**
   * The gesture announced by `onPress` ended without placing the tile: it
   * was cancelled, or the tile was let go out of reach and glides back.
   */
  readonly onAbort: (tile: HTMLButtonElement) => void;
  /** A dragged tile came within reach of the target, or left it. */
  readonly onNear: (near: boolean) => void;
}

export interface TileGestures {
  /** True while an accepted pointer gesture is in progress. */
  readonly active: boolean;
  /** Removes every listener and an active drag at once, with no animation. */
  destroy(): void;
}

interface ActiveDrag {
  readonly tile: HTMLButtonElement;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  /** The pointer has moved past the threshold; the tile follows it. */
  moved: boolean;
}

/**
 * Handles every element matching `tileSelector` inside `container`, now and
 * later.
 */
export function createTileGestures(
  container: HTMLElement,
  tileSelector: string,
  host: TileGestureHost,
): TileGestures {
  const listeners = new AbortController();
  const { signal } = listeners;
  const guard = createTapGuard<HTMLButtonElement>();
  /** The one accepted gesture. Without a record, pointer events do nothing. */
  let active: ActiveDrag | undefined;
  /** Runs the glides home; a new accepted press or destroy() ends them. */
  let glides = createScope();
  /** Tiles gliding home: they still carry the drag styling. */
  const gliding = new Set<HTMLButtonElement>();

  function withinReach(tile: HTMLButtonElement): boolean {
    const rect = tile.getBoundingClientRect();
    const target = host.target();
    const distance = Math.hypot(
      rect.left + rect.width / 2 - (target.left + target.width / 2),
      rect.top + rect.height / 2 - (target.top + target.height / 2),
    );
    return distance <= DROP_REACH * target.width;
  }

  function settle(tile: HTMLButtonElement): void {
    tile.style.transform = "";
    tile.classList.remove("is-dragging");
  }

  function glideBack(tile: HTMLButtonElement): void {
    const from = tile.style.transform;
    tile.style.transform = "";
    if (reducedMotion() || from === "") {
      settle(tile);
      return;
    }
    gliding.add(tile);
    void glides
      .animate(
        tile,
        [{ transform: from }, { transform: "translate(0px, 0px) scale(1)" }],
        { duration: GLIDE_BACK_MS, easing: EASE_OUT },
      )
      .then(() => {
        // Not if endGlides() has settled it already: a newer gesture may
        // have picked the same tile up again.
        if (gliding.delete(tile)) settle(tile);
      });
  }

  /** Every gliding tile is home at once, with its drag styling removed. */
  function endGlides(): void {
    glides.cancel();
    glides = createScope();
    for (const tile of gliding) settle(tile);
    gliding.clear();
  }

  /** Clears the record first, then gives the pointer back (plan 3.3). */
  function release(drag: ActiveDrag): void {
    active = undefined;
    try {
      if (drag.tile.hasPointerCapture(drag.pointerId)) {
        drag.tile.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // The pointer is already gone.
    }
    if (drag.moved) host.onNear(false);
  }

  /**
   * Cancels the accepted gesture. Its pointer may still be down: with the
   * record gone, its pointerup is not an activation, and its click is
   * consumed like that of any pointer gesture. Idempotent; never touches the
   * game's phase.
   */
  function abandon(): void {
    const drag = active;
    if (drag === undefined) return;
    release(drag);
    if (drag.moved) glideBack(drag.tile);
    host.onAbort(drag.tile);
  }

  function onPointerDown(tile: HTMLButtonElement, event: PointerEvent): void {
    // Before anything else, and also for a gesture that is ignored below.
    guard.pointerDown(tile);
    if (active !== undefined || !host.canPlace()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A tile still gliding home must not keep its drag styling into this
    // gesture: a tap would never remove it.
    endGlides();
    active = {
      tile,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    try {
      tile.setPointerCapture(event.pointerId);
    } catch {
      // Without capture the drag ends when the pointer leaves the tile.
    }
    host.onPress(tile);
  }

  function onPointerMove(tile: HTMLButtonElement, event: PointerEvent): void {
    const drag = active;
    if (drag?.tile !== tile || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      tile.classList.add("is-dragging");
    }
    tile.style.transform = `translate(${String(dx)}px, ${String(dy)}px) scale(${String(DRAG_SCALE)})`;
    host.onNear(withinReach(tile));
  }

  function onPointerUp(tile: HTMLButtonElement, event: PointerEvent): void {
    const drag = active;
    // Only the accepted gesture counts: an ignored or cancelled one ends here.
    if (drag?.tile !== tile || drag.pointerId !== event.pointerId) return;
    const canPlace = host.canPlace();
    const dropped = drag.moved && canPlace && withinReach(tile);
    const from = tile.getBoundingClientRect();
    release(drag);
    if (!drag.moved && canPlace) {
      // A tap: it places the tile itself, whether or not a click follows.
      host.onActivate(tile);
    } else if (dropped) {
      settle(tile);
      host.onDrop(tile, from);
    } else {
      if (drag.moved) glideBack(tile);
      host.onAbort(tile);
    }
  }

  function onClick(tile: HTMLButtonElement, event: MouseEvent): void {
    // Consumed before the phase is looked at: the click belongs to a pointer
    // gesture, which its own events have already dealt with.
    if (!guard.clickActivates(tile, event.detail)) return;
    if (active !== undefined || !host.canPlace()) return;
    host.onActivate(tile);
  }

  /** The tile an event on the container belongs to, if any. */
  function tileOf(event: Event): HTMLButtonElement | undefined {
    if (!(event.target instanceof Element)) return undefined;
    const tile = event.target.closest(tileSelector);
    return tile instanceof HTMLButtonElement && container.contains(tile)
      ? tile
      : undefined;
  }

  /** Listens on the container, so tiles can come and go freely. */
  function on<K extends "pointerdown" | "pointermove" | "pointerup" | "click">(
    type: K,
    handle: (tile: HTMLButtonElement, event: HTMLElementEventMap[K]) => void,
  ): void {
    container.addEventListener(
      type,
      (event) => {
        const tile = tileOf(event);
        if (tile !== undefined) handle(tile, event);
      },
      { signal },
    );
  }

  on("pointerdown", onPointerDown);
  on("pointermove", onPointerMove);
  on("pointerup", onPointerUp);
  on("click", onClick);
  const onLost = (event: PointerEvent): void => {
    if (active?.pointerId === event.pointerId) abandon();
  };
  container.addEventListener("pointercancel", onLost, { signal });
  container.addEventListener("lostpointercapture", onLost, { signal });
  container.addEventListener(
    "keydown",
    (event) => {
      const tile = tileOf(event);
      if (tile !== undefined && (event.key === "Enter" || event.key === " ")) {
        guard.keyDown(tile);
      }
    },
    { signal },
  );
  window.addEventListener("blur", abandon, { signal });
  window.addEventListener("resize", abandon, { signal });

  return {
    get active(): boolean {
      return active !== undefined;
    },

    destroy(): void {
      listeners.abort();
      glides.cancel();
      for (const tile of gliding) settle(tile);
      gliding.clear();
      const drag = active;
      if (drag === undefined) return;
      release(drag);
      settle(drag.tile);
    },
  };
}
