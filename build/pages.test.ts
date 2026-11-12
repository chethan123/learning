import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { discoverPages, PageError, parsePageHtml } from "./pages.ts";

function makePagesDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pages-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe("parsePageHtml", () => {
  it("reads title, description and kind", () => {
    expect(
      parsePageHtml(
        "x",
        `<title> Hi </title><meta name="description" content="About it" />
         <script type="module" src="./main.ts"></script>`,
      ),
    ).toEqual({ title: "Hi", description: "About it", kind: "app" });
  });

  it("treats pages without a module script as static", () => {
    expect(parsePageHtml("x", "<title>Hi</title>")).toEqual({
      title: "Hi",
      description: "",
      kind: "static",
    });
  });

  it("decodes HTML entities", () => {
    expect(
      parsePageHtml(
        "x",
        `<title>R&amp;D &#60;notes&#x3E;</title><meta name="description" content="A &quot;b&quot;">`,
      ),
    ).toMatchObject({ title: "R&D <notes>", description: 'A "b"' });
  });

  it("rejects a missing or empty title", () => {
    expect(() => parsePageHtml("x", "<p>no title</p>")).toThrow(PageError);
    expect(() => parsePageHtml("x", "<title>  </title>")).toThrow(PageError);
  });
});

describe("discoverPages", () => {
  it("finds index.html pages sorted by slug and skips other folders", () => {
    const dir = makePagesDir({
      "zeta/index.html": "<title>Z</title>",
      "alpha/index.html": "<title>A</title>",
      "assets-only/logo.svg": "<svg/>",
    });
    expect(discoverPages(dir).map((p) => p.slug)).toEqual(["alpha", "zeta"]);
  });

  it("rejects non-kebab-case folder names", () => {
    const dir = makePagesDir({ "My_Page/index.html": "<title>X</title>" });
    expect(() => discoverPages(dir)).toThrow(/kebab-case/);
  });
});
