/**
 * The DOM of the play screen (plan 3.3, Main.dc.html, Found.dc.html). No game
 * rules here: play.ts decides what happens and when.
 */
import { h } from "../../../shared/dom.ts";
import { graphemesOf } from "../content/letter-sets.ts";
import type { FrameGroup, Tile } from "../content/types.ts";
import {
  blankIsWide,
  frameScale,
  frameWidth,
  isWide,
  trayGap,
} from "./layout.ts";
import { buildCard, buildTile, type SoundUnit } from "./letters.ts";
import { addPicture, createScreen, homeButton } from "./parts.ts";

export interface PlayView {
  readonly screen: HTMLDivElement;
  readonly stage: HTMLDivElement;
  /** Goal slots of a guided round; empty in free play. */
  readonly goals: HTMLDivElement;
  /** Right end of the top bar: the cycle button in free play. */
  readonly end: HTMLDivElement;
  /** The blank and the fixed cards. */
  readonly frame: HTMLDivElement;
  readonly tray: HTMLDivElement;
  /** The hand that shows how to drag a tile. */
  readonly demo: HTMLDivElement;
  /** Covers the viewport; confetti falls through it. */
  readonly confetti: HTMLDivElement;
  /** Polite live region: receives each word that is found. */
  readonly live: HTMLDivElement;
}

export function buildPlayView(onHome: () => void): PlayView {
  const { screen, stage } = createScreen("play");
  const goals = h("div", { class: "goals" });
  const end = h("div", { class: "play-top-end" });
  const frame = h("div", { class: "frame" });
  const tray = h("div", { class: "tray" });
  const demo = h("div", { class: "demo", "aria-hidden": "true" });
  const confetti = h("div", { class: "confetti-layer", "aria-hidden": "true" });
  const live = h("div", { class: "sr-only", "aria-live": "polite" });
  stage.append(
    h("div", { class: "play-top" }, homeButton(onHome), goals, end),
    frame,
    tray,
    demo,
  );
  screen.append(confetti, live);
  return { screen, stage, goals, end, frame, tray, demo, confetti, live };
}

export interface FixedCard {
  readonly grapheme: string;
  readonly button: HTMLButtonElement;
  readonly unit: SoundUnit;
}

export interface TrayPosition {
  /** The fixed place in the tray; shows a dashed hole while its tile is away. */
  readonly slot: HTMLDivElement;
  readonly button: HTMLButtonElement;
}

export interface GroupView {
  readonly blank: HTMLDivElement;
  readonly cards: readonly FixedCard[];
  /** One position per tile of the group, in tray order. */
  readonly positions: ReadonlyMap<Tile, TrayPosition>;
}

/** Replaces the frame and the tray with those of `group`. */
export function buildGroup(
  view: PlayView,
  group: FrameGroup,
  tiles: readonly Tile[],
): GroupView {
  const graphemes = graphemesOf(group.rest);
  view.frame.style.setProperty(
    "--guard",
    String(frameScale(frameWidth(group, graphemes))),
  );
  const blank = h("div", { class: "blank" });
  blank.classList.toggle("is-wide", blankIsWide(group));
  const cards = graphemes.map((grapheme): FixedCard => ({
    grapheme,
    ...buildCard(grapheme),
  }));
  view.frame.replaceChildren(blank, ...cards.map((card) => card.button));

  const positions = new Map<Tile, TrayPosition>();
  for (const tile of tiles) {
    const button = buildTile(tile);
    const slot = h("div", { class: "tray-position" }, button);
    slot.classList.toggle("is-wide", isWide(tile));
    positions.set(tile, { slot, button });
  }
  view.tray.style.setProperty("--gap", String(trayGap(tiles.length)));
  view.tray.replaceChildren(
    ...Array.from(positions.values(), (position) => position.slot),
  );
  return { blank, cards, positions };
}

export type GoalState = "found" | "faint" | "empty";

/**
 * One goal slot. Found: the full picture. Faint: a button with the picture
 * at 40%; tapping it says the word. Empty: a word of another group.
 */
export function buildGoal(
  word: string,
  state: GoalState,
  onTap: (word: string, slot: HTMLElement) => void,
): HTMLElement {
  if (state === "faint") {
    const button = h("button", {
      type: "button",
      class: "goal goal--faint",
      "aria-label": word,
    });
    addPicture(button, word, "goal-image");
    button.addEventListener("click", () => {
      onTap(word, button);
    });
    return button;
  }
  if (state === "empty") {
    return h("div", { class: "goal goal--empty", "aria-hidden": "true" });
  }
  const slot = h("div", {
    class: "goal goal--found",
    role: "img",
    "aria-label": word,
  });
  addPicture(slot, word, "goal-image");
  return slot;
}

/** The big picture of a found word; a button so a tap can replay the word. */
export function buildBigPicture(word: string): HTMLButtonElement {
  const button = h("button", {
    type: "button",
    class: "big-picture",
    "aria-label": word,
  });
  addPicture(button, word, "big-picture-image");
  return button;
}
