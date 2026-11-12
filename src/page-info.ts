/** One page in the site, as listed by the `virtual:pages` module. */
export interface PageInfo {
  /** Folder name under `src/pages/`; also the URL path segment. */
  readonly slug: string;
  /** Text of the page's `<title>`. */
  readonly title: string;
  /** Content of `<meta name="description">`, or "" when absent. */
  readonly description: string;
  /** Whether the page loads any TypeScript module (an app) or is plain HTML. */
  readonly kind: "app" | "static";
}
