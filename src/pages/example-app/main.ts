import "../../shared/base.css";
import "./style.css";

import { h, query } from "../../shared/dom.ts";

// Hash routes keep the app working on any static host: the server only ever
// sees /pages/example-app/, never a deep path it would 404 on.
type Route = "counter" | "about";

function parseRoute(hash: string): Route {
  return hash === "#/about" ? "about" : "counter";
}

const view = query("#view", HTMLElement);
let count = 0;

function render(route: Route): void {
  switch (route) {
    case "counter": {
      const value = h("p", { class: "count" }, String(count));
      const bump = (delta: number) => () => {
        count += delta;
        value.textContent = String(count);
      };
      const minus = h("button", { type: "button" }, "−1");
      const plus = h("button", { type: "button" }, "+1");
      minus.addEventListener("click", bump(-1));
      plus.addEventListener("click", bump(1));
      view.replaceChildren(h("h1", {}, "Counter"), value, minus, plus);
      break;
    }
    case "about":
      view.replaceChildren(
        h("h1", {}, "About"),
        h(
          "p",
          {},
          "Each app lives in src/pages/<slug>/ and builds to its own URL.",
        ),
      );
      break;
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>(".tabs a")) {
    if (parseRoute(link.hash) === route)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

window.addEventListener("hashchange", () => {
  render(parseRoute(location.hash));
});
render(parseRoute(location.hash));
