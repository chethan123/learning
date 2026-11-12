/** Small DOM builders shared by the screens. */
import { h } from "../../../shared/dom.ts";
import { pictureUrl } from "../assets.ts";
import { homeIcon } from "./icons.ts";

export interface Screen {
  /** Fills the viewport and paints the background outside the stage. */
  readonly screen: HTMLDivElement;
  /** The 1024 x 768 design stage, scaled by --u and centred. */
  readonly stage: HTMLDivElement;
}

export function createScreen(name: "trail" | "play" | "stickers"): Screen {
  const stage = h("div", { class: `stage stage--${name}` });
  const screen = h("div", { class: `screen screen--${name}` }, stage);
  return { screen, stage };
}

/** An image that never takes part in dragging, selection or the tab order. */
export function image(url: string, className: string): HTMLImageElement {
  return h("img", {
    class: className,
    src: url,
    alt: "",
    draggable: "false",
    decoding: "async",
  });
}

/**
 * Puts the word's picture into `frame`. While the file does not exist the
 * frame keeps its plain fill (plan 3.2).
 */
export function addPicture(
  frame: HTMLElement,
  word: string,
  className: string,
  lazy = false,
): void {
  const url = pictureUrl(word);
  if (url === undefined) return;
  const img = image(url, className);
  if (lazy) img.loading = "lazy";
  frame.append(img);
}

export function iconButton(
  className: string,
  label: string,
  icon: SVGSVGElement,
): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: className, "aria-label": label },
    icon,
  );
}

/** The 88 px round button that leads back to the trail. */
export function homeButton(onPress: () => void): HTMLButtonElement {
  const button = iconButton(
    "round-button raised",
    "Back to the trail",
    homeIcon(),
  );
  button.addEventListener("click", onPress);
  return button;
}
