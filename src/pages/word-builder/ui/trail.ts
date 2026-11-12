/** The trail: the home screen (plan 3.3, Trail.dc.html). */
import { h } from "../../../shared/dom.ts";
import { MASCOT_URL } from "../assets.ts";
import { stopAll } from "../audio/engine.ts";
import { sfx } from "../audio/sfx.ts";
import { coverWord } from "../content/derive.ts";
import { ROUNDS } from "../content/rounds.ts";
import type { Round } from "../content/types.ts";
import { canPlay, stoneStates, type StoneState } from "../game/progress.ts";
import { getProgress } from "../game/store.ts";
import { bookIcon, dottedPath, gearIcon, holdRing, playIcon } from "./icons.ts";
import {
  hopArc,
  mascotTop,
  scrollTarget,
  STAGE_HEIGHT,
  stoneCentre,
  stripWidth,
  type Point,
} from "./layout.ts";
import { fadeIn, reducedMotion, unitOf } from "./motion.ts";
import { addPicture, createScreen, iconButton, image } from "./parts.ts";
import { createScope, isCancelled, type Scope } from "./scope.ts";
import type { Nav, Teardown } from "./stage.ts";

const HOLD_MS = 2000;
const HOP_MS = 600;
/** The trail is seen for a moment before the mascot sets off. */
const HOP_DELAY_MS = 350;
const HOP_HEIGHT = 110;
const HOP_STEPS = 12;
/** Design px between two clouds of the same kind. */
const CLOUD_EVERY = 760;

function place(element: HTMLElement, at: Point): void {
  element.style.setProperty("--x", String(at.x));
  element.style.setProperty("--y", String(at.y));
}

function buildStone(
  round: Round,
  state: StoneState,
  playable: boolean,
  nav: Nav,
): HTMLButtonElement {
  const number = String(round.number);
  const stone = h("button", { type: "button", class: `stone stone--${state}` });
  place(stone, stoneCentre(round.number - 1));
  switch (state) {
    case "done":
      stone.classList.add("raised");
      stone.setAttribute("aria-label", `Round ${number}, finished`);
      addPicture(stone, coverWord(round), "stone-picture", true);
      stone.addEventListener("click", () => {
        nav.go(`#/free/${round.id}`);
      });
      break;
    case "current":
      stone.classList.add("raised");
      stone.setAttribute("aria-label", `Play round ${number}`);
      stone.append(playIcon());
      stone.addEventListener("click", () => {
        nav.go(`#/play/${round.id}`);
      });
      break;
    case "locked":
      stone.setAttribute("aria-label", `Round ${number}`);
      if (playable) {
        stone.classList.add("is-open");
        stone.append(playIcon());
        stone.addEventListener("click", () => {
          nav.go(`#/play/${round.id}`);
        });
      } else {
        stone.disabled = true;
      }
      break;
  }
  return stone;
}

function buildMascot(): HTMLDivElement {
  const mascot = h("div", { class: "mascot", "aria-hidden": "true" });
  if (MASCOT_URL !== undefined) {
    mascot.append(image(MASCOT_URL, "mascot-picture"));
  }
  return mascot;
}

function buildScenery(width: number): readonly HTMLElement[] {
  const scenery: HTMLElement[] = [
    h("div", { class: "trail-grass", "aria-hidden": "true" }),
  ];
  for (let x = 250; x < width; x += CLOUD_EVERY) {
    const small = h("div", { class: "cloud cloud--small" });
    place(small, { x, y: 132 });
    const large = h("div", { class: "cloud cloud--large" });
    place(large, { x: x + 360, y: 84 });
    scenery.push(small, large);
  }
  return scenery;
}

/**
 * The grown-ups button opens only after an unbroken 2 s press, shown by a
 * ring that fills round it. A keyboard or assistive-technology activation
 * (a click with detail 0) opens at once.
 */
function buildGrownUpsButton(
  open: () => void,
  signal: AbortSignal,
): HTMLElement {
  const button = iconButton(
    "grown-ups-button",
    "Grown-ups: press and hold",
    gearIcon(),
  );
  const { svg, ring } = holdRing();
  const wrap = h("div", { class: "grown-ups" }, svg, button);
  let hold: Scope | undefined;

  const cancel = (): void => {
    hold?.cancel();
    hold = undefined;
    wrap.classList.remove("is-held");
  };
  const start = (event: PointerEvent): void => {
    if (!event.isPrimary || hold !== undefined) return;
    const press = createScope();
    hold = press;
    wrap.classList.add("is-held");
    void press.animate(
      ring,
      [{ strokeDashoffset: "100" }, { strokeDashoffset: "0" }],
      { duration: HOLD_MS, easing: "linear" },
    );
    void press.sleep(HOLD_MS).then(() => {
      if (isCancelled(press)) return;
      cancel();
      open();
    });
  };
  const leftButton = (event: PointerEvent): boolean => {
    const rect = button.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };

  button.addEventListener("pointerdown", start, { signal });
  button.addEventListener("pointerup", cancel, { signal });
  button.addEventListener("pointercancel", cancel, { signal });
  button.addEventListener("pointerleave", cancel, { signal });
  button.addEventListener(
    "pointermove",
    (event) => {
      if (hold !== undefined && leftButton(event)) cancel();
    },
    { signal },
  );
  button.addEventListener(
    "click",
    (event) => {
      if (event.detail === 0) open();
    },
    { signal },
  );
  window.addEventListener("blur", cancel, { signal });
  signal.addEventListener("abort", cancel);
  return wrap;
}

export function mountTrail(
  root: HTMLElement,
  nav: Nav,
  justCompleted: string | undefined,
): Teardown {
  const listeners = new AbortController();
  const { signal } = listeners;
  const scope = createScope();
  const progress = getProgress();
  const states = stoneStates(progress);
  const width = stripWidth(ROUNDS.length);

  const { screen, stage } = createScreen("trail");
  const ground = h("div", { class: "trail-ground" });
  ground.style.setProperty("--strip", String(width));
  const strip = h("div", { class: "trail-strip" }, ground);

  const centres = ROUNDS.map((_, index) => stoneCentre(index));
  ground.append(
    ...buildScenery(width),
    dottedPath(width, STAGE_HEIGHT, [{ x: -40, y: 540 }, ...centres]),
  );

  const currentIndex = states.indexOf("current");
  const halo = h("div", { class: "stone-halo", "aria-hidden": "true" });
  if (currentIndex >= 0) {
    place(halo, stoneCentre(currentIndex));
    ground.append(halo);
  }
  ROUNDS.forEach((round, index) => {
    const state = states[index] ?? "locked";
    ground.append(buildStone(round, state, canPlay(progress, round), nav));
  });

  // The mascot stands above the current stone, or above the last one when
  // every round is finished.
  const mascotIndex = currentIndex >= 0 ? currentIndex : ROUNDS.length - 1;
  const mascotAt = stoneCentre(mascotIndex);
  const mascot = buildMascot();
  mascot.style.setProperty("--x", String(mascotAt.x));
  mascot.style.setProperty(
    "--top",
    String(mascotTop(mascotAt.y, currentIndex >= 0 ? "current" : "done")),
  );
  ground.append(mascot);

  const stickers = iconButton(
    "sticker-book-button raised",
    "Sticker book",
    bookIcon(),
  );
  stickers.addEventListener("click", () => {
    nav.go("#/stickers");
  });
  stage.append(
    strip,
    buildGrownUpsButton(() => {
      nav.go("#/grown-ups");
    }, signal),
    stickers,
  );
  // Beside the stage the grass carries on to the edges of the viewport.
  screen.prepend(
    h("div", { class: "trail-grass-wide", "aria-hidden": "true" }),
  );
  root.append(screen);

  strip.scrollLeft = scrollTarget(
    mascotAt.x,
    unitOf(stage),
    strip.scrollWidth - strip.clientWidth,
  );
  // A mouse wheel turns the strip; touch and trackpads pan it natively.
  strip.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        strip.scrollLeft += event.deltaY;
      }
    },
    { passive: true, signal },
  );

  const previous = currentIndex > 0 ? ROUNDS[currentIndex - 1] : undefined;
  const hops = previous !== undefined && previous.id === justCompleted;

  async function arrive(): Promise<void> {
    if (hops && !reducedMotion()) {
      const from = stoneCentre(currentIndex - 1);
      const u = unitOf(stage);
      const start: Point = {
        x: (from.x - mascotAt.x) * u,
        y: (mascotTop(from.y, "done") - mascotTop(mascotAt.y, "current")) * u,
      };
      const hop = scope.animate(
        mascot,
        hopArc(start, HOP_HEIGHT * u, HOP_STEPS).map((point) => ({
          transform: `translate(${String(point.x)}px, ${String(point.y)}px)`,
        })),
        {
          duration: HOP_MS,
          delay: HOP_DELAY_MS,
          easing: "linear",
          fill: "backwards",
        },
      );
      await scope.sleep(HOP_DELAY_MS);
      if (isCancelled(scope)) return;
      sfx("hop");
      await hop;
      if (isCancelled(scope)) return;
    } else if (hops) {
      await fadeIn(scope, mascot, 150);
      if (isCancelled(scope)) return;
    }
    halo.classList.add("is-on");
  }
  void arrive();

  return () => {
    listeners.abort();
    scope.cancel();
    stopAll();
    screen.remove();
  };
}
