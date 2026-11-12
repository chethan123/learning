/**
 * Inline SVG builders. Shapes come from the screen designs; colours and sizes
 * come from style.css (classes `icon`, `icon--<name>` and the `i-*` paints),
 * so an icon scales with the stage like everything else.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

type Attrs = Readonly<Record<string, string>>;

function shape<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  ...children: readonly SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }
  el.append(...children);
  return el;
}

function icon(
  name: string,
  viewBox: string,
  ...children: readonly SVGElement[]
): SVGSVGElement {
  return shape(
    "svg",
    {
      class: `icon icon--${name}`,
      viewBox,
      "aria-hidden": "true",
      focusable: "false",
    },
    ...children,
  );
}

const STAR =
  "M36 6 L45 26 L67 28 L50 43 L55 65 L36 53 L17 65 L22 43 L5 28 L27 26 Z";

export function homeIcon(): SVGSVGElement {
  return icon(
    "home",
    "0 0 48 48",
    shape("path", { class: "i-line i-w5", d: "M6 24 L24 8 L42 24" }),
    shape("path", { class: "i-line i-w5", d: "M12 22 V40 H36 V22" }),
  );
}

/** White triangle with an ink outline: the current stone and unlocked stones. */
export function playIcon(): SVGSVGElement {
  return icon(
    "play",
    "0 0 84 92",
    shape("path", {
      class: "i-line i-w8 i-fill-card",
      d: "M12 10 L72 46 L12 82 Z",
    }),
  );
}

export function arrowIcon(): SVGSVGElement {
  return icon(
    "arrow",
    "0 0 112 88",
    shape("path", { class: "i-line i-w14", d: "M12 44 H96" }),
    shape("path", { class: "i-line i-w14", d: "M64 12 L98 44 L64 76" }),
  );
}

export function bookIcon(): SVGSVGElement {
  return icon(
    "book",
    "0 0 64 64",
    shape("path", {
      class: "i-line i-w5 i-fill-card",
      d: "M10 10 H46 A8 8 0 0 1 54 18 V54 H18 A8 8 0 0 1 10 46 Z",
    }),
    shape("path", {
      class: "i-line i-w5 i-fill-tile",
      d: "M32 20 L35.5 28 L44 29 L37.5 34.5 L39.5 43 L32 38.5 L24.5 43 L26.5 34.5 L20 29 L28.5 28 Z",
    }),
  );
}

export function gearIcon(): SVGSVGElement {
  return icon(
    "gear",
    "0 0 30 30",
    shape("circle", { class: "i-quiet", cx: "15", cy: "15", r: "5" }),
    shape("path", {
      class: "i-quiet",
      d: "M15 2 V6 M15 24 V28 M2 15 H6 M24 15 H28 M6 6 L9 9 M21 21 L24 24 M6 24 L9 21 M21 9 L24 6",
    }),
  );
}

export function starIcon(size: "small" | "large"): SVGSVGElement {
  const el = icon(
    "star",
    "0 0 72 72",
    shape("path", {
      class: `i-line i-fill-tile ${size === "large" ? "i-w4" : "i-w5"}`,
      d: STAR,
    }),
  );
  el.classList.add(`icon--star-${size}`);
  return el;
}

/**
 * A pointing hand. Drawn twice: thick ink shapes underneath, then the same
 * shapes in white on top, so the overlapping parts share one outline.
 */
export function handIcon(): SVGSVGElement {
  const parts = (paint: string): readonly SVGElement[] => [
    // Index finger.
    shape("rect", {
      class: paint,
      x: "24",
      y: "8",
      width: "16",
      height: "44",
      rx: "8",
    }),
    // Thumb.
    shape("rect", {
      class: paint,
      x: "6",
      y: "40",
      width: "30",
      height: "16",
      rx: "8",
      transform: "rotate(38 21 48)",
    }),
    // Palm with the three folded fingers.
    shape("rect", {
      class: paint,
      x: "22",
      y: "36",
      width: "38",
      height: "38",
      rx: "13",
    }),
  ];
  return icon(
    "hand",
    "0 0 68 82",
    ...parts("i-hand-ink"),
    ...parts("i-hand-skin"),
    shape("path", { class: "i-line i-w3", d: "M40 44 V52 M50 44 V52" }),
  );
}

/** Two arrows chasing each other round a circle: next group in free play. */
export function cycleIcon(): SVGSVGElement {
  const half = (): SVGGElement =>
    shape(
      "g",
      {},
      shape("path", {
        class: "i-line i-w6",
        d: "M13.2 25.2 A20 20 0 0 1 49 21",
      }),
      shape("path", {
        class: "i-line i-w6 i-fill-ink",
        d: "M53 30 L41 27 L52 16 Z",
      }),
    );
  const second = half();
  second.setAttribute("transform", "rotate(180 32 32)");
  return icon("cycle", "0 0 64 64", half(), second);
}

/** The ring that fills while the grown-ups button is held. */
export function holdRing(): {
  readonly svg: SVGSVGElement;
  readonly ring: SVGCircleElement;
} {
  const ring = shape("circle", {
    class: "hold-ring-track",
    cx: "40",
    cy: "40",
    r: "36",
    pathLength: "100",
    transform: "rotate(-90 40 40)",
  });
  return { svg: icon("hold-ring", "0 0 80 80", ring), ring };
}

/** A dotted white line through the given points, for the trail. */
export function dottedPath(
  width: number,
  height: number,
  points: readonly { readonly x: number; readonly y: number }[],
): SVGSVGElement {
  const el = icon(
    "trail-path",
    `0 0 ${String(width)} ${String(height)}`,
    shape("polyline", {
      class: "i-trail-dots",
      points: points
        .map((point) => `${String(point.x)},${String(point.y)}`)
        .join(" "),
    }),
  );
  el.setAttribute("preserveAspectRatio", "none");
  return el;
}
