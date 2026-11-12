# learning

Vite multi-page site: single-page apps and static pages, strict TypeScript, npm.

- One page per folder at `src/pages/<kebab-slug>/index.html`. Discovery and the
  `virtual:pages` manifest live in `build/`. Don't hand-edit the build inputs in
  `vite.config.ts`.
- Scaffold with `npm run new -- <slug> [--static]`. Apps route with `#/hash`
  URLs, and all URLs stay relative (`base: "./"`) so `dist/` can be hosted on
  any path.
- Shared browser code and CSS go in `src/shared/`. Use `query()` from
  `src/shared/dom.ts` rather than `querySelector` with `as` or `!`.
- `src/` is browser-only (`tsconfig.app.json`). `build/`, `scripts/` and
  `*.config.ts` are Node-only (`tsconfig.node.json`).
- Use named exports only; config files are the exception. Keep `any`, `as`
  casts and non-null `!` out of the code.
- Docker: `compose.yaml` builds the site and serves `dist/` with Caddy on
  :8080; it runs non-root with a read-only root, so the `Caddyfile` must not
  need writable paths outside `/tmp`. `compose.dev.yaml` runs the Vite dev
  server from the Dockerfile's `dev` stage.
- Before finishing, run `npm run check`; it must pass clean.
- The system Node may lack TypeScript stripping, so run TS scripts with `tsx`,
  not `node file.ts`.
