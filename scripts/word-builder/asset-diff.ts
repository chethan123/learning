/** Compare asset names without depending on their input order or duplicates. */
export function assetDiff(
  expected: readonly string[],
  actual: readonly string[],
): {
  readonly missing: readonly string[];
  readonly unexpected: readonly string[];
} {
  const wanted = new Set(expected);
  const present = new Set(actual);
  return {
    missing: [...wanted].filter((name) => !present.has(name)).sort(),
    unexpected: [...present].filter((name) => !wanted.has(name)).sort(),
  };
}
