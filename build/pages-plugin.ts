import { join, sep } from "node:path";

import type { Plugin } from "vite";

import type { PageInfo } from "../src/page-info.ts";
import { discoverPages } from "./pages.ts";

const VIRTUAL_ID = "virtual:pages";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Turns every `src/pages/<slug>/index.html` into a build entry and exposes the
 * list to browser code as the typed `virtual:pages` module.
 */
export function pagesPlugin(srcDir: string): Plugin {
  const pagesDir = join(srcDir, "pages");

  return {
    name: "learning:pages",
    config() {
      const input: Record<string, string> = {
        index: join(srcDir, "index.html"),
      };
      for (const page of discoverPages(pagesDir)) input[page.slug] = page.entry;
      return { build: { rolldownOptions: { input } } };
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const pages: PageInfo[] = discoverPages(pagesDir).map(
        ({ slug, title, description, kind }) => ({
          slug,
          title,
          description,
          kind,
        }),
      );
      return `export const pages = ${JSON.stringify(pages)};`;
    },
    configureServer(server) {
      // Adding, removing or retitling a page refreshes the home page listing.
      const refresh = (file: string): void => {
        if (!file.startsWith(pagesDir + sep) || !file.endsWith("index.html"))
          return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
      server.watcher.on("change", refresh);
    },
  };
}
