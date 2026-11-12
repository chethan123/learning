/**
 * Typed querySelector: returns the element as `type` or throws, so pages never
 * carry `| null` around or cast with `as`.
 *
 * @example const button = query("#go", HTMLButtonElement);
 */
export function query<T extends Element>(
  selector: string,
  type: abstract new () => T,
  root: ParentNode = document,
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) {
    throw new Error(
      el === null
        ? `No element matches "${selector}".`
        : `"${selector}" is a <${el.tagName.toLowerCase()}>, not a ${type.name}.`,
    );
  }
  return el;
}

/** Creates an element with text and attributes in one typed call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  ...children: readonly (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs))
    el.setAttribute(name, value);
  el.append(...children);
  return el;
}
