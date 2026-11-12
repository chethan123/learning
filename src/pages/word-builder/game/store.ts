import { EMPTY_PROGRESS, type Progress } from "./progress.ts";
import {
  eraseStoredProgress,
  readStoredProgress,
  writeStoredProgress,
} from "./storage.ts";

let live: Progress | undefined;

/** Reads storage once, on first call. */
export function getProgress(): Progress {
  live ??= readStoredProgress();
  return live;
}

/** Sets the live value, then writes it best-effort. */
export function updateProgress(
  change: (current: Progress) => Progress,
): Progress {
  const next = change(getProgress());
  live = next;
  writeStoredProgress(next);
  return next;
}

export function resetProgress(): void {
  live = EMPTY_PROGRESS;
  eraseStoredProgress();
}
