/**
 * Motion helpers shared by the screens. Everything runs through a Scope, so a
 * screen that is torn down stops its animations (plan 5.2).
 *
 * Pattern used throughout: put the element in its final state first, then
 * animate from where it was. Nothing depends on `fill: forwards`, and a
 * cancelled animation leaves the element where it belongs.
 *
 * With `prefers-reduced-motion: reduce` a move becomes a 150 ms cross-fade
 * (plan 3.5); holds and gaps keep their length at the call sites.
 */
import { STAGE_WIDTH } from "./layout.ts";
import type { Scope } from "./scope.ts";

export const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.3, 1)";
export const EASE_IN = "cubic-bezier(0.6, 0, 0.9, 0.5)";
export const EASE_IN_OUT = "cubic-bezier(0.5, 0, 0.3, 1)";
/** Overshoots a little: for things that pop into place. */
export const EASE_POP = "cubic-bezier(0.3, 1.5, 0.5, 1)";

const CROSS_FADE_MS = 150;

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** CSS px per design px: the current value of --u. */
export function unitOf(stage: Element): number {
  return stage.getBoundingClientRect().width / STAGE_WIDTH;
}

function centreOf(rect: DOMRect): { readonly x: number; readonly y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function fadeIn(
  scope: Scope,
  element: Element,
  ms: number,
): Promise<void> {
  return scope.animate(element, [{ opacity: 0 }, { opacity: 1 }], {
    duration: reducedMotion() ? CROSS_FADE_MS : ms,
    easing: "ease-out",
  });
}

export function fadeOut(
  scope: Scope,
  element: Element,
  ms: number,
): Promise<void> {
  // The element may already carry its hidden end state; stay visible for now.
  return scope.animate(
    element,
    [
      { opacity: 1, visibility: "visible" },
      { opacity: 0, visibility: "visible" },
    ],
    { duration: reducedMotion() ? CROSS_FADE_MS : ms, easing: "ease-in" },
  );
}

/**
 * The element is already in its final place and has no transform of its own;
 * it travels there from `from` (viewport rect), changing size on the way.
 */
export function flyFrom(
  scope: Scope,
  element: Element,
  from: DOMRect,
  ms: number,
  easing: string = EASE_OUT,
): Promise<void> {
  if (reducedMotion()) return fadeIn(scope, element, CROSS_FADE_MS);
  const to = element.getBoundingClientRect();
  if (to.width === 0 || to.height === 0) return Promise.resolve();
  const start = centreOf(from);
  const end = centreOf(to);
  const dx = start.x - end.x;
  const dy = start.y - end.y;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return scope.animate(
    element,
    [
      {
        transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(sx)}, ${String(sy)})`,
      },
      { transform: "translate(0px, 0px) scale(1, 1)" },
    ],
    { duration: ms, easing },
  );
}

/**
 * Runs `change` (a layout change) and animates each element from its old
 * place and size to its new one.
 */
export async function flip(
  scope: Scope,
  elements: readonly Element[],
  change: () => void,
  ms: number,
  easing: string = EASE_IN_OUT,
): Promise<void> {
  const before = elements.map((element) => element.getBoundingClientRect());
  change();
  await Promise.all(
    elements.map((element, index) => {
      const from = before[index];
      return from === undefined
        ? Promise.resolve()
        : flyFrom(scope, element, from, ms, easing);
    }),
  );
}

/** Scales up from small with a little overshoot. */
export function popIn(
  scope: Scope,
  element: Element,
  ms: number,
  delay = 0,
): Promise<void> {
  if (reducedMotion()) {
    return scope.animate(element, [{ opacity: 0 }, { opacity: 1 }], {
      duration: CROSS_FADE_MS,
      delay,
      fill: "backwards",
    });
  }
  return scope.animate(
    element,
    [
      { transform: "scale(0.2)", opacity: 0 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: ms, delay, easing: EASE_POP, fill: "backwards" },
  );
}

/** A quick squash and stretch for something that was tapped. */
export function bounce(scope: Scope, element: Element): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  return scope.animate(
    element,
    [
      { transform: "scale(1)" },
      { transform: "scale(1.12)", offset: 0.35 },
      { transform: "scale(0.96)", offset: 0.7 },
      { transform: "scale(1)" },
    ],
    { duration: 320, easing: "ease-out" },
  );
}
