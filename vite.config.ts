import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

import { pagesPlugin } from "./build/pages-plugin.ts";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  root: srcDir,
  // Relative asset URLs: dist/ works from any host or sub-path (GitHub Pages,
  // an S3 folder, a zip someone opens locally through a static server).
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [pagesPlugin(srcDir)],
});
