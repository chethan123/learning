declare module "virtual:pages" {
  /** Every page under `src/pages/`, sorted by slug. Generated at build time. */
  // An ambient module can't use a relative `import` statement; `import()` types can.
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  export const pages: readonly import("./page-info.ts").PageInfo[];
}
