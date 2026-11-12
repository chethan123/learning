// Scaffolds a page: npm run new -- <slug> [--static] [--title "Nice title"]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { SLUG_PATTERN } from "../build/pages.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    static: { type: "boolean", default: false },
    title: { type: "string" },
  },
});

const slug = positionals[0];
if (slug === undefined || !SLUG_PATTERN.test(slug)) {
  console.error(
    'Usage: npm run new -- <kebab-case-slug> [--static] [--title "Title"]',
  );
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "src", "pages", slug);
if (existsSync(dir)) {
  console.error(`src/pages/${slug} already exists.`);
  process.exit(1);
}

const title =
  values.title ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${String(c.codePointAt(0))};`);

const head = (extra: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="" />
    <link rel="icon" href="data:," />${extra}
  </head>`;

mkdirSync(dir, { recursive: true });

if (values.static) {
  writeFileSync(
    join(dir, "index.html"),
    `${head('\n    <link rel="stylesheet" href="../../shared/base.css" />')}
  <body>
    <main>
      <p><a href="../../">← All pages</a></p>
      <h1>${escapeHtml(title)}</h1>
    </main>
  </body>
</html>
`,
  );
} else {
  writeFileSync(
    join(dir, "index.html"),
    `${head("")}
  <body>
    <main>
      <p><a href="../../">← All pages</a></p>
      <div id="app"></div>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`,
  );
  writeFileSync(
    join(dir, "main.ts"),
    `import "../../shared/base.css";
import "./style.css";

import { h, query } from "../../shared/dom.ts";

const app = query("#app", HTMLDivElement);
app.append(h("h1", {}, ${JSON.stringify(title)}));
`,
  );
  writeFileSync(join(dir, "style.css"), "");
}

console.log(
  `Created src/pages/${slug}/ → npm run dev, then open /pages/${slug}/`,
);
