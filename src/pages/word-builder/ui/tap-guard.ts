/**
 * Which `click` events activate a tile (plan 3.3, "Placing a tile").
 *
 * A pointer gesture on a tile is dealt with by its own events: a tap places
 * the tile at pointerup (Chrome sends no `click` for a tap made shortly after
 * a flicked drag, so waiting for the click would lose that tap), a drag drops
 * it or lets it glide back, and a gesture that was cancelled or ignored does
 * nothing. In every one of those cases the browser may still send a `click`
 * for the gesture, and that click must not place the tile.
 *
 * So each pointerdown marks its tile, and the mark suppresses exactly one
 * `click`. A `click` that no pointer gesture on the tile preceded (keyboard,
 * assistive technology) activates. The mark is renewed by every pointerdown,
 * and cleared by keydown of Enter or Space, by a click with detail 0, and by
 * the one click it suppresses.
 */
export interface TapGuard<T extends object> {
  /**
   * At the start of every pointerdown on the tile, whether or not the
   * gesture is accepted: the click it leads to is not an activation.
   */
  pointerDown(tile: T): void;
  /** On keydown of Enter or Space: the click that follows activates. */
  keyDown(tile: T): void;
  /**
   * A `click` arrived on the tile. Returns true if it activates the tile;
   * false if it belongs to a pointer gesture.
   */
  clickActivates(tile: T, detail: number): boolean;
}

export function createTapGuard<T extends object>(): TapGuard<T> {
  /** Tiles whose next pointer click is to be ignored. */
  const suppressed = new WeakSet<T>();
  return {
    pointerDown(tile: T): void {
      suppressed.add(tile);
    },
    keyDown(tile: T): void {
      suppressed.delete(tile);
    },
    clickActivates(tile: T, detail: number): boolean {
      // delete() reports whether the mark was set, and clears it either way.
      const wasSuppressed = suppressed.delete(tile);
      return detail === 0 || !wasSuppressed;
    },
  };
}
