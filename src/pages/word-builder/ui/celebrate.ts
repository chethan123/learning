/** The end of a guided round (plan 3.3 step 4, RoundDone.dc.html). */
import { h } from "../../../shared/dom.ts";
import { sfx } from "../audio/sfx.ts";
import { launchConfetti } from "./confetti.ts";
import { arrowIcon, starIcon } from "./icons.ts";
import { celebrationPose, celebrationStickerSize } from "./layout.ts";
import { popIn } from "./motion.ts";
import { addPicture, iconButton } from "./parts.ts";
import type { Scope } from "./scope.ts";

const STICKER_STAGGER_MS = 140;

function buildSticker(
  word: string,
  index: number,
  count: number,
): HTMLDivElement {
  const pose = celebrationPose(index, count);
  const sticker = h("div", {
    class: "celebration-sticker",
    role: "img",
    "aria-label": word,
  });
  sticker.style.setProperty("--size", String(celebrationStickerSize(count)));
  sticker.style.setProperty("--turn", String(pose.rotate));
  sticker.style.setProperty("--rise", String(pose.rise));
  addPicture(sticker, word, "celebration-image");
  return sticker;
}

/**
 * Adds the celebration to the stage and plays it: the round's stickers in
 * the order found, three stars, confetti, the fanfare and the go button.
 * Nothing advances by itself; `onGo` runs when the button is pressed.
 */
export function celebrate(
  stage: HTMLElement,
  confettiLayer: HTMLElement,
  words: readonly string[],
  scope: Scope,
  onGo: () => void,
): void {
  const stickers = words.map((word, index) =>
    buildSticker(word, index, words.length),
  );
  const stars = [starIcon("small"), starIcon("large"), starIcon("small")];
  const go = iconButton("go-button raised", "Keep going", arrowIcon());
  go.addEventListener("click", onGo);

  stage.append(
    h(
      "div",
      { class: "celebration" },
      h("div", { class: "celebration-stickers" }, ...stickers),
      h("div", { class: "celebration-stars", "aria-hidden": "true" }, ...stars),
      go,
    ),
  );

  sfx("fanfare");
  launchConfetti(confettiLayer, scope);
  const afterStickers = stickers.length * STICKER_STAGGER_MS;
  stickers.forEach((sticker, index) => {
    void popIn(scope, sticker, 420, index * STICKER_STAGGER_MS);
  });
  stars.forEach((star, index) => {
    void popIn(scope, star, 360, afterStickers + index * 110);
  });
  void popIn(scope, go, 420, afterStickers + 380);
}
