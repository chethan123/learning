import { ALL_WORDS } from "./content/derive.ts";
import type { Clip } from "./content/types.ts";

const pictures = import.meta.glob<string>("./assets/pictures/*.webp", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
const audio = import.meta.glob<string>("./assets/audio/**/*.mp3", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
const words = new Set(ALL_WORDS);

/** Throws for unknown words; missing files are allowed during asset generation. */
export function pictureUrl(word: string): string | undefined {
  if (!words.has(word)) {
    throw new Error(`Unknown picture word: ${word}`);
  }
  return pictures[`./assets/pictures/${word}.webp`];
}

export const MASCOT_URL: string | undefined =
  pictures["./assets/pictures/mascot.webp"];

export function clipUrl(clip: Clip): string | undefined {
  const folder = clip.kind === "word" ? "words" : "sounds";
  return audio[`./assets/audio/${folder}/${clip.id}.mp3`];
}
