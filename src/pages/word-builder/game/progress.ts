import { ALL_WORDS, roundById, wordsOf } from "../content/derive.ts";
import { ROUNDS } from "../content/rounds.ts";
import type { Round } from "../content/types.ts";

export interface RoundInProgress {
  readonly roundId: string;
  readonly found: readonly string[];
}

export interface Progress {
  readonly version: 1;
  readonly completedRounds: readonly string[];
  readonly foundWords: readonly string[];
  /** Guided rounds left unfinished, at most one entry per round. */
  readonly inProgress: readonly RoundInProgress[];
  readonly unlockAll: boolean;
  readonly seenDragDemo: boolean;
}

export const EMPTY_PROGRESS: Progress = {
  version: 1,
  completedRounds: [],
  foundWords: [],
  inProgress: [],
  unlockAll: false,
  seenDragDemo: false,
};

const KNOWN_ROUND_IDS: ReadonlySet<string> = new Set(
  ROUNDS.map((round) => round.id),
);
const KNOWN_WORDS: ReadonlySet<string> = new Set(ALL_WORDS);

/** Strings of `value` that pass `keep`, first occurrences only, in order. */
function keptStrings(
  value: unknown,
  keep: (entry: string) => boolean,
): readonly string[] {
  if (!Array.isArray(value)) return [];
  const entries: readonly unknown[] = value;
  const result: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "string" && keep(entry) && !result.includes(entry)) {
      result.push(entry);
    }
  }
  return result;
}

function parseInProgressEntry(
  value: unknown,
  completed: readonly string[],
): RoundInProgress | null {
  if (typeof value !== "object" || value === null) return null;
  const roundId = "roundId" in value ? value.roundId : undefined;
  if (typeof roundId !== "string" || completed.includes(roundId)) return null;
  const round = roundById(roundId);
  if (round === undefined) return null;
  const words = wordsOf(round);
  const found = keptStrings(
    "found" in value ? value.found : undefined,
    (word) => words.includes(word),
  );
  if (found.length === 0 || found.length >= words.length) return null;
  return { roundId, found };
}

function parseInProgress(
  value: unknown,
  completed: readonly string[],
): readonly RoundInProgress[] {
  if (!Array.isArray(value)) return [];
  const entries: readonly unknown[] = value;
  const seen = new Set<string>();
  const result: RoundInProgress[] = [];
  for (const entry of entries) {
    // Only the first entry for a round counts, even if it is itself invalid.
    const roundId =
      typeof entry === "object" && entry !== null && "roundId" in entry
        ? entry.roundId
        : undefined;
    if (typeof roundId === "string") {
      if (seen.has(roundId)) continue;
      seen.add(roundId);
    }
    const parsed = parseInProgressEntry(entry, completed);
    if (parsed !== null) result.push(parsed);
  }
  return result;
}

export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== "object" || raw === null) return EMPTY_PROGRESS;
  const version = "version" in raw ? raw.version : undefined;
  if (version !== 1) return EMPTY_PROGRESS;
  const completedRounds = keptStrings(
    "completedRounds" in raw ? raw.completedRounds : undefined,
    (id) => KNOWN_ROUND_IDS.has(id),
  );
  const unlockAll = "unlockAll" in raw ? raw.unlockAll : undefined;
  const seenDragDemo = "seenDragDemo" in raw ? raw.seenDragDemo : undefined;
  return {
    version: 1,
    completedRounds,
    foundWords: keptStrings(
      "foundWords" in raw ? raw.foundWords : undefined,
      (word) => KNOWN_WORDS.has(word),
    ),
    inProgress: parseInProgress(
      "inProgress" in raw ? raw.inProgress : undefined,
      completedRounds,
    ),
    unlockAll: unlockAll === true,
    seenDragDemo: seenDragDemo === true,
  };
}

function withEntries(
  list: readonly string[],
  entries: readonly string[],
): readonly string[] {
  const added = entries.filter((entry, i) => {
    return !list.includes(entry) && entries.indexOf(entry) === i;
  });
  return added.length === 0 ? list : [...list, ...added];
}

/** Adds the word to foundWords and to this round's inProgress entry (created if missing; other rounds' entries are kept). Idempotent. */
export function recordFound(
  progress: Progress,
  round: Round,
  word: string,
): Progress {
  const existing = progress.inProgress.find(
    (entry) => entry.roundId === round.id,
  );
  const updated: RoundInProgress = {
    roundId: round.id,
    found: withEntries(existing?.found ?? [], [word]),
  };
  return {
    ...progress,
    foundWords: withEntries(progress.foundWords, [word]),
    inProgress:
      existing === undefined
        ? [...progress.inProgress, updated]
        : progress.inProgress.map((entry) =>
            entry.roundId === round.id ? updated : entry,
          ),
  };
}

/** Adds the round to completedRounds and its words to foundWords; removes this round's inProgress entry. Idempotent. */
export function completeRound(progress: Progress, round: Round): Progress {
  return {
    ...progress,
    completedRounds: withEntries(progress.completedRounds, [round.id]),
    foundWords: withEntries(progress.foundWords, wordsOf(round)),
    inProgress: progress.inProgress.filter(
      (entry) => entry.roundId !== round.id,
    ),
  };
}

/** Words to pass to startSession for a guided visit: this round's inProgress entry's found words, else none. */
export function resumeWords(
  progress: Progress,
  round: Round,
): readonly string[] {
  return (
    progress.inProgress.find((entry) => entry.roundId === round.id)?.found ?? []
  );
}

export function setUnlockAll(progress: Progress, on: boolean): Progress {
  return { ...progress, unlockAll: on };
}

export function setSeenDragDemo(progress: Progress): Progress {
  return { ...progress, seenDragDemo: true };
}

export type StoneState = "done" | "current" | "locked";

export function stoneStates(progress: Progress): readonly StoneState[] {
  let currentTaken = false;
  return ROUNDS.map((round): StoneState => {
    if (progress.completedRounds.includes(round.id)) return "done";
    if (currentTaken) return "locked";
    currentTaken = true;
    return "current";
  });
}

/** First round not completed. */
export function currentRound(progress: Progress): Round | undefined {
  return ROUNDS.find((round) => !progress.completedRounds.includes(round.id));
}

export function canPlay(progress: Progress, round: Round): boolean {
  if (progress.completedRounds.includes(round.id)) return false;
  return progress.unlockAll || currentRound(progress)?.id === round.id;
}

export function canFreePlay(progress: Progress, round: Round): boolean {
  return progress.completedRounds.includes(round.id);
}
