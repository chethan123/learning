import "./shared/base.css";
import "./home.css";

import { pages } from "virtual:pages";

import { h, query } from "./shared/dom.ts";

const list = query("#pages", HTMLUListElement);

list.append(
  ...pages.map((page) =>
    h(
      "li",
      {},
      h(
        "a",
        { href: `./pages/${page.slug}/` },
        h("span", { class: "title" }, page.title),
        h("span", { class: "kind" }, page.kind),
        ...(page.description === ""
          ? []
          : [h("p", { class: "desc" }, page.description)]),
      ),
    ),
  ),
);

if (pages.length === 0) {
  list.append(h("li", {}, "No pages yet. Run: npm run new -- my-page"));
}
