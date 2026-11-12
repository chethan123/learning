/** The sticker book (plan 3.3, Stickers.dc.html). */
import { h } from "../../../shared/dom.ts";
import { playClip, stopAll } from "../audio/engine.ts";
import { ALL_WORDS } from "../content/derive.ts";
import { getProgress } from "../game/store.ts";
import { bookIcon } from "./icons.ts";
import { stickerRotation } from "./layout.ts";
import { bounce } from "./motion.ts";
import { addPicture, createScreen, homeButton } from "./parts.ts";
import { createScope, type Scope } from "./scope.ts";
import type { Nav, Teardown } from "./stage.ts";

function buildFound(word: string, scope: Scope): HTMLButtonElement {
  const picture = h("span", { class: "sticker-picture raised" });
  picture.style.setProperty("--turn", String(stickerRotation(word)));
  addPicture(picture, word, "sticker-image", true);
  const button = h(
    "button",
    { type: "button", class: "sticker", "aria-label": word },
    picture,
    h("span", { class: "sticker-word", "aria-hidden": "true" }, word),
  );
  button.addEventListener("click", () => {
    void playClip({ kind: "word", id: word });
    void bounce(scope, picture);
  });
  return button;
}

function buildEmpty(): HTMLDivElement {
  return h(
    "div",
    { class: "sticker sticker--empty", "aria-hidden": "true" },
    h("span", { class: "sticker-picture" }),
    h("span", { class: "sticker-bar" }),
  );
}

export function mountStickers(root: HTMLElement, nav: Nav): Teardown {
  const scope = createScope();
  const found = new Set(getProgress().foundWords);
  const { screen, stage } = createScreen("stickers");

  const header = h(
    "div",
    { class: "stickers-header" },
    homeButton(() => {
      nav.go("#/");
    }),
    bookIcon(),
  );
  const grid = h(
    "div",
    { class: "stickers-grid" },
    ...ALL_WORDS.map((word) =>
      found.has(word) ? buildFound(word, scope) : buildEmpty(),
    ),
  );
  stage.append(header, h("div", { class: "stickers-scroll" }, grid));
  root.append(screen);

  return () => {
    scope.cancel();
    stopAll();
    screen.remove();
  };
}
