import "@fontsource/andika/latin-400.css";
import "@fontsource/andika/latin-700.css";
import "./style.css";

import { query } from "../../shared/dom.ts";
import { unlockAudio } from "./audio/engine.ts";
import { createNav, startRouter } from "./ui/stage.ts";

// Audio may only start inside a gesture, and Safari suspends it again when the
// page is backgrounded: try on every gesture, before any screen handles it.
for (const type of ["pointerdown", "pointerup", "click", "keydown"]) {
  document.addEventListener(
    type,
    () => {
      unlockAudio();
    },
    { capture: true },
  );
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") unlockAudio();
});

// No pinch zoom and no double-tap zoom, on any screen.
for (const type of ["gesturestart", "dblclick"]) {
  document.addEventListener(type, (event) => {
    event.preventDefault();
  });
}

// A long press must not open a menu over the game (touch laptops do this).
document.addEventListener("contextmenu", (event) => {
  if (event.target instanceof Element && event.target.closest(".screen")) {
    event.preventDefault();
  }
});

// The trail shows no letters; fetch the font now so the first round has it.
document.fonts.load('700 1em "Andika"', "a").catch(() => undefined);

startRouter(query("#app", HTMLDivElement), createNav());
