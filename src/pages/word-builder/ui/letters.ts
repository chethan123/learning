/**
 * The letter pieces of the play screen: movable tiles, the card a placed tile
 * becomes, and the fixed cards. Each piece exposes one SoundUnit per sound,
 * in reading order: a letter or a digraph is one unit, a blend is two halves.
 */
import { h } from "../../../shared/dom.ts";
import { graphemesOf } from "../content/letter-sets.ts";
import type { Tile } from "../content/types.ts";
import { isWide } from "./layout.ts";

export interface SoundUnit {
  /** Lights up while the sound plays. */
  readonly box: HTMLElement;
  /** The letter or letters; swells while the sound plays. */
  readonly glyph: HTMLElement;
  /** Hops while the sound plays; absent for one half of a blend. */
  readonly lift: HTMLElement | undefined;
}

/**
 * Fills `piece` with the letters of `text`. A digraph gets the bar under both
 * letters; a blend becomes two halves with a divider (plan 3.3).
 */
function addLetters(piece: HTMLElement, text: string): readonly SoundUnit[] {
  if (isWide(text)) piece.classList.add("is-wide");
  const graphemes = graphemesOf(text);
  if (graphemes.length === 1) {
    const glyph = h("span", { class: "glyph" }, text);
    piece.append(glyph);
    if (isWide(text)) {
      piece.classList.add("is-digraph");
      piece.append(h("span", { class: "digraph-bar" }));
    }
    return [{ box: piece, glyph, lift: piece }];
  }
  piece.classList.add("is-blend");
  return graphemes.map((grapheme) => {
    const glyph = h("span", { class: "glyph" }, grapheme);
    const half = h("span", { class: "half" }, glyph);
    piece.append(half);
    return { box: half, glyph, lift: undefined };
  });
}

/** A movable tile in the tray. */
export function buildTile(tile: Tile): HTMLButtonElement {
  const button = h("button", {
    type: "button",
    class: "tile raised",
    "aria-label": `Tile ${tile}`,
    "data-tile": tile,
  });
  addLetters(button, tile);
  return button;
}

/** A copy of a tile that cannot be touched: the ghost of the hand demo. */
export function buildGhostTile(tile: Tile): HTMLDivElement {
  const ghost = h("div", { class: "tile tile--ghost", "aria-hidden": "true" });
  addLetters(ghost, tile);
  return ghost;
}

export interface Piece {
  readonly el: HTMLElement;
  readonly units: readonly SoundUnit[];
}

/** The tile as it sits on the blank: card sized, tile coloured. */
export function buildPlaced(tile: Tile): Piece {
  const el = h("div", { class: "card card--placed" });
  return { el, units: addLetters(el, tile) };
}

/** One fixed card of the frame: a letter or a digraph of the rest. */
export function buildCard(grapheme: string): {
  readonly button: HTMLButtonElement;
  readonly unit: SoundUnit;
} {
  const button = h("button", {
    type: "button",
    class: "card card--fixed",
    "aria-label": `${isWide(grapheme) ? "Letters" : "Letter"} ${grapheme}`,
  });
  const unit = addLetters(button, grapheme)[0];
  if (unit === undefined) {
    throw new Error(`Card "${grapheme}" has no letters`);
  }
  return { button, unit };
}
