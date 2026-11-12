/** Navigation and screen mounting (plan 5.2). */
import { getProgress } from "../game/store.ts";
import { mountGrownUps } from "./grown-ups.ts";
import { mountPlay } from "./play.ts";
import { resolveRoute, type Route } from "./router.ts";
import { mountStickers } from "./stickers.ts";
import { mountTrail } from "./trail.ts";

export type Teardown = () => void;

export interface Nav {
  go(hash: string, options?: { readonly justCompleted: string }): void;
}

/**
 * The round whose celebration led to the next mount. The next screen mount of
 * any kind takes it and clears it, so a redirect, a reload and history
 * navigation never replay the mascot's hop.
 */
let justCompleted: string | undefined;

export function createNav(): Nav {
  return {
    go(hash: string, options?: { readonly justCompleted: string }): void {
      justCompleted = options?.justCompleted;
      location.hash = hash;
    },
  };
}

function mount(
  root: HTMLElement,
  nav: Nav,
  route: Route,
  completed: string | undefined,
): Teardown {
  switch (route.screen) {
    case "trail":
      return mountTrail(root, nav, completed);
    case "play":
      return mountPlay(root, nav, route.round, "guided");
    case "free":
      return mountPlay(root, nav, route.round, "free");
    case "stickers":
      return mountStickers(root, nav);
    case "grown-ups":
      return mountGrownUps(root, nav);
  }
}

/** Listens for hashchange, resolves the route, tears down the old screen and mounts the new one. */
export function startRouter(root: HTMLElement, nav: Nav): void {
  let teardown: Teardown | undefined;

  function render(): void {
    const route = resolveRoute(location.hash, getProgress());
    if ("redirect" in route) {
      justCompleted = undefined;
      // Replaces the refused entry; the hashchange that follows mounts "#/".
      location.replace(route.redirect);
      return;
    }
    const completed = justCompleted;
    justCompleted = undefined;
    teardown?.();
    root.replaceChildren();
    teardown = mount(root, nav, route, completed);
  }

  window.addEventListener("hashchange", render);
  render();
}
