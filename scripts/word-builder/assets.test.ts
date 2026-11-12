import { readdirSync, statSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ALL_SOUNDS,
  ALL_WORDS,
} from "../../src/pages/word-builder/content/derive.ts";
import { assetDiff } from "./asset-diff.ts";

it("reports sorted missing and unexpected names without duplicates", () => {
  expect(assetDiff(["z", "a", "b", "a"], ["c", "b", "d", "c"])).toEqual({
    missing: ["a", "z"],
    unexpected: ["c", "d"],
  });
  expect(assetDiff(["a", "b"], ["b", "a"])).toEqual({
    missing: [],
    unexpected: [],
  });
  expect(assetDiff([], [])).toEqual({ missing: [], unexpected: [] });
});

describe("complete bundled Word Builder assets", () => {
  const root = new URL("../../src/pages/word-builder/assets/", import.meta.url);
  const folders = [
    {
      path: "pictures/",
      names: [...ALL_WORDS.map((word) => `${word}.webp`), "mascot.webp"],
    },
    { path: "audio/words/", names: ALL_WORDS.map((word) => `${word}.mp3`) },
    { path: "audio/sounds/", names: ALL_SOUNDS.map((id) => `${id}.mp3`) },
  ];

  for (const folder of folders) {
    it(`${folder.path} contains exactly the expected non-empty files`, () => {
      const directory = new URL(folder.path, root);
      const actual = readdirSync(directory);
      expect(assetDiff(folder.names, actual)).toEqual({
        missing: [],
        unexpected: [],
      });
      for (const name of actual) {
        const file = statSync(new URL(name, directory));
        expect(file.isFile(), name).toBe(true);
        expect(file.size, name).toBeGreaterThan(0);
      }
    });
  }
});
