import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { PageInfo } from "../src/page-info.ts";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface DiscoveredPage extends PageInfo {
  /** Absolute path to the page's `index.html`, used as a build entry. */
  readonly entry: string;
}

export class PageError extends Error {
  override readonly name = "PageError";
}

/** Reads the page metadata Vite needs out of a page's HTML. */
export function parsePageHtml(
  slug: string,
  html: string,
): Omit<PageInfo, "slug"> {
  const title = decodeEntities(
    /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "",
  ).trim();
  if (title === "") {
    throw new PageError(`Page "${slug}" needs a non-empty <title>.`);
  }
  const description = decodeEntities(
    /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(
      html,
    )?.[1] ?? "",
  ).trim();
  const kind = /<script\b[^>]*\btype=["']module["']/i.test(html)
    ? "app"
    : "static";
  return { title, description, kind };
}

/**
 * Finds every `<pagesDir>/<slug>/index.html`. Folders without an index.html
 * are ignored so they can hold shared assets; bad slugs or missing titles fail
 * loudly so a broken page never ships silently.
 */
export function discoverPages(pagesDir: string): DiscoveredPage[] {
  const pages: DiscoveredPage[] = [];
  for (const slug of readdirSync(pagesDir).sort()) {
    const dir = join(pagesDir, slug);
    const entry = join(dir, "index.html");
    if (!statSync(dir).isDirectory() || !isFile(entry)) continue;
    if (!SLUG_PATTERN.test(slug)) {
      throw new PageError(
        `Page folder "${slug}" must be kebab-case (a-z, 0-9, dashes).`,
      );
    }
    pages.push({
      slug,
      entry,
      ...parsePageHtml(slug, readFileSync(entry, "utf8")),
    });
  }
  return pages;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/** Decodes the entities a <title> or attribute is likely to contain. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ref: string) => {
    if (ref.startsWith("#")) {
      const code =
        ref[1] === "x" || ref[1] === "X"
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
