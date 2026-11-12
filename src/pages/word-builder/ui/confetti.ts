/**
 * DOM confetti for the celebration (plan 3.3). Pieces fall through `layer`
 * and are removed when they land or when the scope is cancelled.
 */
import { h } from "../../../shared/dom.ts";
import { reducedMotion } from "./motion.ts";
import { isCancelled, type Scope } from "./scope.ts";

const PIECES = 56;
const COLOURS = 4; // style.css paints .confetti--0 to .confetti--3
const TOTAL_MS = 2500;
const SHORTEST_FALL_MS = 1300;

/** Starts the confetti and returns at once; it is over after 2.5 s. */
export function launchConfetti(layer: HTMLElement, scope: Scope): void {
  if (reducedMotion() || isCancelled(scope)) return;
  const { width, height } = layer.getBoundingClientRect();
  if (width === 0 || height === 0) return;

  for (let index = 0; index < PIECES; index += 1) {
    const round = index % 3 === 0;
    const piece = h("div", {
      class: `confetti confetti--${String(index % COLOURS)} ${
        round ? "confetti--dot" : "confetti--strip"
      }`,
      "aria-hidden": "true",
    });
    piece.style.left = `${String(Math.random() * 100)}%`;
    layer.append(piece);

    const delay = Math.random() * (TOTAL_MS - SHORTEST_FALL_MS) * 0.6;
    const duration =
      SHORTEST_FALL_MS + Math.random() * (TOTAL_MS - SHORTEST_FALL_MS - delay);
    const drift = (Math.random() - 0.5) * width * 0.25;
    const turns = (Math.random() - 0.5) * 6;
    const startTurn = Math.random() * 360;
    void scope
      .animate(
        piece,
        [
          {
            transform: `translate(0px, 0px) rotate(${String(startTurn)}deg)`,
          },
          {
            transform: `translate(${String(drift)}px, ${String(height * 1.15)}px) rotate(${String(startTurn + turns * 360)}deg)`,
          },
        ],
        {
          duration,
          delay,
          easing: "cubic-bezier(0.3, 0.1, 0.7, 1)",
          fill: "backwards",
        },
      )
      .then(() => {
        piece.remove();
      });
  }
}
