import { clipUrl } from "../assets.ts";
import type { Clip } from "../content/types.ts";

let context: AudioContext | undefined;
let pendingResume: Promise<void> | undefined;
let sessionConfigured = false;
let voice: { readonly cancel: () => void } | undefined;
interface Loading<T> {
  readonly promise: Promise<T>;
  readonly cancel: () => void;
}

const downloads = new Map<string, Loading<ArrayBuffer>>();
const buffers = new Map<string, Loading<AudioBuffer>>();
const reported = new Set<string>();

/** Bound the shared operation, including callers that only preload it. */
function bounded<T>(
  start: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Loading<T> {
  const controller = new AbortController();
  let cancel = (): void => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      fail(new Error("Audio operation timed out"));
    }, timeoutMs);

    function fail(error: unknown): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      controller.abort();
      reject(
        error instanceof Error
          ? error
          : new Error("Audio operation failed", { cause: error }),
      );
    }

    cancel = () => {
      fail(new Error("Audio operation cancelled"));
    };
    try {
      void start(controller.signal).then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }, fail);
    } catch (error) {
      fail(error);
    }
  });
  return { promise, cancel };
}

function hasAudioSession(
  value: Navigator,
): value is Navigator & { readonly audioSession: { type: string } } {
  return (
    "audioSession" in value &&
    typeof value.audioSession === "object" &&
    value.audioSession !== null &&
    "type" in value.audioSession &&
    typeof value.audioSession.type === "string"
  );
}

/** Call synchronously from each unlocking gesture, and on becoming visible. */
export function unlockAudio(): void {
  try {
    if (!sessionConfigured && hasAudioSession(navigator)) {
      navigator.audioSession.type = "playback";
      sessionConfigured = true;
    }
    const current = (context ??= new AudioContext());
    if (current.state !== "running") {
      const resume = bounded(() => current.resume(), 500).promise.catch(
        () => undefined,
      );
      pendingResume = resume;
      void resume.then(() => {
        if (pendingResume === resume) pendingResume = undefined;
      });
    }
  } catch {
    // Audio can be unavailable or refused; another gesture may try again.
  }
}

/** Effects share the context, but never create or resume it. */
export function audioContextIfRunning(): AudioContext | undefined {
  return context?.state === "running" ? context : undefined;
}

function report(clip: Clip): void {
  const key = `${clip.kind}:${clip.id}`;
  if (reported.has(key)) return;
  reported.add(key);
  console.warn(`Could not load audio clip ${key}`);
}

function download(url: string): Loading<ArrayBuffer> {
  const cached = downloads.get(url);
  if (cached !== undefined) return cached;
  const loading = bounded(
    (signal) =>
      fetch(url, { signal }).then((response) => {
        signal.throwIfAborted();
        if (!response.ok)
          throw new Error(`Audio HTTP ${String(response.status)}`);
        return response.arrayBuffer();
      }),
    2000,
  );
  downloads.set(url, loading);
  void loading.promise.catch(() => {
    if (downloads.get(url) === loading) downloads.delete(url);
  });
  return loading;
}

function load(url: string, current: AudioContext): Promise<AudioBuffer> {
  const cached = buffers.get(url);
  if (cached !== undefined) return cached.promise;
  const downloading = download(url);
  const loading = bounded(
    (signal) =>
      downloading.promise.then((data) => {
        signal.throwIfAborted();
        return current.decodeAudioData(data);
      }),
    2000,
  );
  buffers.set(url, loading);

  function releaseDownload(): void {
    if (downloads.get(url) !== downloading) return;
    downloads.delete(url);
    downloading.cancel();
  }

  void loading.promise.then(releaseDownload, () => {
    if (buffers.get(url) === loading) buffers.delete(url);
    releaseDownload();
  });
  return loading.promise;
}

export function preload(clips: readonly Clip[]): void {
  const current = context;
  for (const clip of clips) {
    const url = clipUrl(clip);
    if (url !== undefined) {
      // Direct links can preload bytes before a gesture creates the context.
      // Decoding then waits until the next preload or playback request.
      const loading =
        current === undefined ? download(url).promise : load(url, current);
      void loading.catch(() => {
        report(clip);
      });
    }
  }
}

/** A new request cancels the preceding voice, including its pending load. */
export function playClip(clip: Clip): Promise<boolean> {
  stopAll();
  const current = context;
  const url = clipUrl(clip);
  if (current === undefined || url === undefined) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    let source: AudioBufferSourceNode | undefined;
    let gain: GainNode | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function clearTimer(): void {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    }

    function finish(played: boolean): void {
      if (settled) return;
      settled = true;
      clearTimer();
      if (voice === request) voice = undefined;
      if (source !== undefined) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          // The source may already have ended, or start() may have failed.
        }
        source.disconnect();
      }
      gain?.disconnect();
      resolve(played);
    }

    const request = {
      cancel: () => {
        finish(false);
      },
    };
    voice = request;

    const startPlayback = (buffer: AudioBuffer): void => {
      if (settled) return;
      clearTimer();
      if (current.state !== "running") {
        finish(false);
        return;
      }
      try {
        source = current.createBufferSource();
        source.buffer = buffer;
        gain = current.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(current.destination);
        source.onended = () => {
          finish(true);
        };
        timer = setTimeout(
          () => {
            finish(false);
          },
          buffer.duration * 1000 + 500,
        );
        source.start();
      } catch {
        finish(false);
      }
    };

    function loadFailed(): void {
      if (settled) return;
      report(clip);
      finish(false);
    }

    const startLoading = (): void => {
      if (settled) return;
      clearTimer();
      try {
        void load(url, current).then(startPlayback, loadFailed);
      } catch {
        loadFailed();
      }
    };

    if (current.state === "running") {
      startLoading();
    } else if (pendingResume !== undefined) {
      let resumeFinished = false;
      const afterResume = (): void => {
        if (settled || resumeFinished) return;
        resumeFinished = true;
        clearTimer();
        if (current.state === "running") startLoading();
        else finish(false);
      };
      timer = setTimeout(afterResume, 500);
      void pendingResume.then(afterResume, afterResume);
    } else {
      finish(false);
    }
  });
}

/** Stops only the voice; independently scheduled effects can finish. */
export function stopAll(): void {
  voice?.cancel();
}
