/**
 * The grown-ups page (plan 3.3): settings and the contact sheet for
 * approving words, pictures and audio. Plain text, not on the stage.
 */
import { h } from "../../../shared/dom.ts";
import { clipUrl, pictureUrl } from "../assets.ts";
import { playClip, stopAll } from "../audio/engine.ts";
import { ALL_SOUNDS, ALL_WORDS } from "../content/derive.ts";
import { ROUNDS } from "../content/rounds.ts";
import type { Clip, FrameGroup, Round } from "../content/types.ts";
import { setUnlockAll } from "../game/progress.ts";
import { getProgress, resetProgress, updateProgress } from "../game/store.ts";
import { image } from "./parts.ts";
import type { Nav, Teardown } from "./stage.ts";

const ERASE_CONFIRM_MS = 5000;

function clipButton(clip: Clip, label: string): HTMLButtonElement {
  const missing = clipUrl(clip) === undefined;
  const button = h(
    "button",
    { type: "button", class: "gu-clip" },
    missing ? `${label} (no clip yet)` : `▶ ${label}`,
  );
  if (missing) button.classList.add("is-missing");
  button.addEventListener("click", () => {
    void playClip(clip);
  });
  return button;
}

function wordFigure(word: string): HTMLElement {
  const url = pictureUrl(word);
  const picture =
    url === undefined
      ? h("div", { class: "gu-picture gu-picture--missing" }, "no picture yet")
      : image(url, "gu-picture");
  if (picture instanceof HTMLImageElement) {
    picture.alt = word;
    picture.loading = "lazy";
  }
  return h(
    "div",
    { class: "gu-word" },
    picture,
    clipButton({ kind: "word", id: word }, word),
  );
}

function groupBlock(group: FrameGroup): HTMLElement {
  const extras = group.extras.length === 0 ? "none" : group.extras.join(", ");
  return h(
    "div",
    { class: "gu-group" },
    h(
      "p",
      { class: "gu-frame" },
      h("strong", {}, `_${group.rest}`),
      ` extra tiles: ${extras}`,
    ),
    h(
      "div",
      { class: "gu-words" },
      ...group.winning.map((tile) => wordFigure(tile + group.rest)),
    ),
  );
}

function roundRow(round: Round): HTMLTableRowElement {
  return h(
    "tr",
    {},
    h("td", {}, String(round.number)),
    h("td", {}, round.id),
    h("td", {}, String(round.letterSet)),
    h("td", {}, ...round.groups.map(groupBlock)),
  );
}

function count(have: number, of: number): string {
  return `${String(have)} of ${String(of)}`;
}

function assetSummary(): string {
  const pictures = ALL_WORDS.filter(
    (word) => pictureUrl(word) !== undefined,
  ).length;
  const wordClips = ALL_WORDS.filter(
    (id) => clipUrl({ kind: "word", id }) !== undefined,
  ).length;
  const soundClips = ALL_SOUNDS.filter(
    (id) => clipUrl({ kind: "sound", id }) !== undefined,
  ).length;
  return [
    `Pictures: ${count(pictures, ALL_WORDS.length)}.`,
    `Word clips: ${count(wordClips, ALL_WORDS.length)}.`,
    `Sound clips: ${count(soundClips, ALL_SOUNDS.length)}.`,
  ].join(" ");
}

export function mountGrownUps(root: HTMLElement, nav: Nav): Teardown {
  let eraseTimer: ReturnType<typeof setTimeout> | undefined;

  const unlock = h("input", { type: "checkbox", id: "gu-unlock" });
  unlock.checked = getProgress().unlockAll;
  unlock.addEventListener("change", () => {
    updateProgress((progress) => setUnlockAll(progress, unlock.checked));
  });

  const erase = h("button", { type: "button", class: "gu-erase" });
  const disarm = (): void => {
    clearTimeout(eraseTimer);
    eraseTimer = undefined;
    erase.textContent = "Erase progress";
  };
  disarm();
  erase.addEventListener("click", () => {
    if (eraseTimer === undefined) {
      erase.textContent = "Press again to erase";
      eraseTimer = setTimeout(disarm, ERASE_CONFIRM_MS);
      return;
    }
    disarm();
    resetProgress();
    nav.go("#/");
  });

  const page = h(
    "div",
    { class: "grown-ups-page" },
    h(
      "nav",
      { class: "gu-links" },
      h("a", { href: "#/" }, "Back to the game"),
      h("a", { href: "../../" }, "All pages"),
    ),
    h("h1", {}, "Word Builder: for grown-ups"),
    h(
      "section",
      { class: "gu-settings" },
      h("label", { for: "gu-unlock" }, unlock, " Unlock every round"),
      erase,
    ),
    h("h2", {}, "Content review"),
    h("p", {}, assetSummary()),
    h(
      "table",
      { class: "gu-table" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", { scope: "col" }, "#"),
          h("th", { scope: "col" }, "Id"),
          h("th", { scope: "col" }, "Letter set"),
          h("th", { scope: "col" }, "Groups"),
        ),
      ),
      h("tbody", {}, ...ROUNDS.map(roundRow)),
    ),
    h("h2", {}, "Sound clips"),
    h(
      "div",
      { class: "gu-sounds" },
      ...ALL_SOUNDS.map((id) => clipButton({ kind: "sound", id }, id)),
    ),
  );
  root.append(page);

  return () => {
    clearTimeout(eraseTimer);
    stopAll();
    page.remove();
  };
}
