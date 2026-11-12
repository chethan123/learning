# learning

A collection of small single-page apps and static pages, built with Vite and
strict TypeScript. Every page builds to its own URL, and a generated home page
lists them all.

## Use

```sh
npm install
npm run dev                       # http://localhost:5173 — home page lists every page
npm run new -- my-app             # scaffold a TypeScript app in src/pages/my-app/
npm run new -- my-notes --static  # scaffold a plain HTML page
npm run check                     # format, lint, typecheck, test
npm run build                     # typecheck, then build to dist/
npm run preview                   # serve dist/ locally
```

## Docker

```sh
docker compose up -d --build                 # production: http://localhost:8080
docker compose -f compose.dev.yaml up        # dev server with hot reload: http://localhost:5173
```

- **Production** (`compose.yaml`) builds the site in a Node stage and serves
  `dist/` with Caddy on port 8080 (`Caddyfile`). The image has no Node and no
  source code. It runs as uid 1000 with a read-only root, all capabilities
  dropped, and memory, CPU and process limits. `/healthz` backs the
  healthcheck. Files under `assets/` are cached as immutable and HTML is
  revalidated, so a redeploy shows up right away. A type error fails the image
  build. Rebuild (`--build`) after changing pages.
- **Dev** (`compose.dev.yaml`) runs the Vite dev server with the repo
  bind-mounted, so edits and new pages reload live. Its `node_modules` lives in
  a Docker volume, separate from the host's.
- Ports bind to `127.0.0.1` by default. Copy `.env.example` to `.env` and set
  `BIND=0.0.0.0` to expose the site on the network, or `PORT` to move it.
- Behind a reverse proxy (such as the self-hosted Sidecar Caddy), drop the
  `ports:` mapping and point the proxy at `learning:8080`.

## Layout

```
src/
  index.html, home.ts     home page; lists pages from the typed `virtual:pages` module
  pages/<slug>/index.html one folder per page → dist/pages/<slug>/index.html
  shared/                 code and CSS any page can import (base.css, dom.ts)
build/                    page discovery + the Vite plugin that wires it up
scripts/new-page.ts       the `npm run new` scaffolder
public/                   files copied to dist/ as-is
```

A page is any `src/pages/<slug>/index.html`. It's an **app** when it loads a
`<script type="module">` and **static** otherwise. Both kinds get their CSS,
images and scripts bundled and hashed. The build fails if a page folder isn't
kebab-case or a page has no `<title>`. The title and
`<meta name="description">` feed the home page listing.

## Sharing

`dist/` uses relative URLs (`base: "./"`), so you can upload it to any static
host, including a sub-path such as GitHub Pages, S3, Netlify, Cloudflare Pages
or nginx. To share one page, link to `…/pages/<slug>/`. Apps should route with
`#/hash` URLs (see `example-app`), so a static host never sees a deep path it
would 404 on.

## Type safety

- `tsconfig.base.json` turns on `strict` plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`,
  `erasableSyntaxOnly` and friends.
- Two projects (`tsc -b`): `tsconfig.app.json` for browser code (DOM libs),
  `tsconfig.node.json` for build tooling (Node types). Neither can use the
  other's globals.
- ESLint runs `strictTypeChecked` + `stylisticTypeChecked` with zero warnings
  allowed.
- `query(selector, HTMLButtonElement)` from `src/shared/dom.ts` returns a typed
  element or throws, so page code needs neither `as` casts nor `!`.
