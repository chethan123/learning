// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { h, query } from "./dom.ts";

describe("query", () => {
  it("returns the element typed as requested", () => {
    document.body.replaceChildren(h("button", { id: "go" }, "Go"));
    expect(query("#go", HTMLButtonElement).textContent).toBe("Go");
  });

  it("throws when nothing matches or the type is wrong", () => {
    document.body.replaceChildren(h("div", { id: "box" }));
    expect(() => query("#missing", HTMLElement)).toThrow(/No element/);
    expect(() => query("#box", HTMLButtonElement)).toThrow(/<div>/);
  });
});
