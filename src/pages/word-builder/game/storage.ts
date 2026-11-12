import { EMPTY_PROGRESS, parseProgress, type Progress } from "./progress.ts";

const KEY = "word-builder:v1";

/** Any failure (no storage, blocked, corrupt JSON) gives EMPTY_PROGRESS. */
export function readStoredProgress(): Progress {
  try {
    const text = localStorage.getItem(KEY);
    if (text === null) return EMPTY_PROGRESS;
    return parseProgress(JSON.parse(text));
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function writeStoredProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage may be full, blocked or missing; the live value is unaffected.
  }
}

export function eraseStoredProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do when storage is unavailable.
  }
}
