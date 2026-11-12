// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Clip } from "../content/types.ts";

vi.mock("../assets.ts", () => ({
  clipUrl: vi.fn((clip: Clip) =>
    clip.id === "missing" ? undefined : `/audio/${clip.kind}/${clip.id}.mp3`,
  ),
}));

class FakeSource {
  buffer: { readonly duration: number } | null = null;
  onended: (() => void) | null = null;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeGain {
  readonly gain = { value: 0 };
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "running";
  readonly destination = {};
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly resume = vi.fn(() => {
    this.state = "running";
    return Promise.resolve();
  });
  readonly decodeAudioData = vi.fn(() => Promise.resolve({ duration: 0.25 }));

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
}

function currentContext(): FakeAudioContext {
  const context = FakeAudioContext.instances[0];
  if (context === undefined) throw new Error("Audio was not unlocked");
  return context;
}

function currentSource(): FakeSource {
  const source = currentContext().sources.at(-1);
  if (source === undefined) throw new Error("No source was created");
  return source;
}

function response(): Response {
  return new Response(new Uint8Array([1, 2, 3]));
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: Error) => void;
} {
  let resolve: (value: T) => void = () => {
    throw new Error("Promise has not been created");
  };
  let reject: (error: Error) => void = () => {
    throw new Error("Promise has not been created");
  };
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const mat: Clip = { kind: "word", id: "mat" };
const cat: Clip = { kind: "word", id: "cat" };

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response())),
  );
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("voice playback", () => {
  it("settles immediately without a context and queues no sound", async () => {
    const engine = await import("./engine.ts");
    await expect(engine.playClip(mat)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(0);
    engine.unlockAudio();
    await vi.advanceTimersByTimeAsync(0);
    expect(currentContext().sources).toHaveLength(0);
  });

  it("settles immediately when the clip has no URL", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    await expect(
      engine.playClip({ kind: "word", id: "missing" }),
    ).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses one lazy context and configures the audio session once", async () => {
    const session = { type: "auto" };
    vi.stubGlobal("navigator", { audioSession: session });
    const engine = await import("./engine.ts");
    expect(engine.audioContextIfRunning()).toBeUndefined();
    engine.unlockAudio();
    expect(session.type).toBe("playback");
    session.type = "transient";
    engine.unlockAudio();
    expect(session.type).toBe("transient");
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("stops a playing voice before a newer voice and caches by URL", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const first = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    const oldSource = currentSource();
    expect(oldSource.start).toHaveBeenCalledOnce();
    expect(currentContext().gains[0]?.gain.value).toBe(1);
    const second = engine.playClip(mat);
    await expect(first).resolves.toBe(false);
    expect(oldSource.stop).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    const newSource = currentSource();
    expect(newSource).not.toBe(oldSource);
    newSource.onended?.();
    await expect(second).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    expect(currentContext().decodeAudioData).toHaveBeenCalledOnce();
  });

  it("never starts an older voice whose fetch finishes after cancellation", async () => {
    let finishFetch: (value: Response) => void = () => {
      throw new Error("Fetch has not started");
    };
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishFetch = resolve;
        }),
    );
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const first = engine.playClip(mat);
    const second = engine.playClip(cat);
    await expect(first).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    finishFetch(response());
    await vi.advanceTimersByTimeAsync(0);
    expect(currentContext().sources).toHaveLength(1);
    currentSource().onended?.();
    await expect(second).resolves.toBe(true);
  });

  it("cancels a pending decode with stopAll and never starts it later", async () => {
    let finishDecode: (value: { duration: number }) => void = () => {
      throw new Error("Decode has not started");
    };
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    currentContext().decodeAudioData.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishDecode = resolve;
        }),
    );
    const playing = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    engine.stopAll();
    await expect(playing).resolves.toBe(false);
    finishDecode({ duration: 0.25 });
    await vi.advanceTimersByTimeAsync(0);
    expect(currentContext().sources).toHaveLength(0);
  });

  it("times out loading at 2000 ms, warns once, and ignores late completion", async () => {
    let finishFetch: (value: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishFetch = resolve;
        }),
    );
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const result = vi.fn();
    const first = engine.playClip(mat).then(result);
    await vi.advanceTimersByTimeAsync(1999);
    expect(result).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await first;
    expect(result).toHaveBeenCalledWith(false);
    const second = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(second).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("mat"));
    finishFetch(response());
    await vi.advanceTimersByTimeAsync(0);
    expect(currentContext().sources).toHaveLength(0);
  });

  it.each(["fetch", "body", "decode"])(
    "retries from scratch after a hanging %s times out",
    async (stage) => {
      const engine = await import("./engine.ts");
      engine.unlockAudio();
      if (stage === "fetch") {
        vi.mocked(fetch).mockImplementationOnce(
          () => new Promise(() => undefined),
        );
      } else if (stage === "body") {
        const stalled = response();
        vi.spyOn(stalled, "arrayBuffer").mockImplementationOnce(
          () => new Promise(() => undefined),
        );
        vi.mocked(fetch).mockResolvedValueOnce(stalled);
      } else {
        currentContext().decodeAudioData.mockImplementationOnce(
          () => new Promise(() => undefined),
        );
      }
      const first = engine.playClip(mat);
      await vi.advanceTimersByTimeAsync(2000);
      await expect(first).resolves.toBe(false);
      expect(currentContext().sources).toHaveLength(0);
      if (stage !== "decode") {
        expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      }

      const retry = engine.playClip(mat);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(currentContext().decodeAudioData).toHaveBeenCalledTimes(
        stage === "decode" ? 2 : 1,
      );
      currentSource().onended?.();
      await expect(retry).resolves.toBe(true);
      expect(console.warn).toHaveBeenCalledOnce();
    },
  );

  it("ignores a late fetch without disturbing a newer download for the same URL", async () => {
    const stale = deferred<Response>();
    const healthy = deferred<Response>();
    vi.mocked(fetch)
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => healthy.promise);
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const first = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(first).resolves.toBe(false);

    const retry = engine.playClip(mat);
    stale.resolve(response());
    await vi.advanceTimersByTimeAsync(0);
    expect(currentContext().sources).toHaveLength(0);
    expect(currentContext().decodeAudioData).not.toHaveBeenCalled();
    engine.preload([mat]);
    expect(fetch).toHaveBeenCalledTimes(2);
    healthy.resolve(response());
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(retry).resolves.toBe(true);

    const cached = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(cached).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(currentContext().decodeAudioData).toHaveBeenCalledOnce();
  });

  it.each(["resolve", "reject"])(
    "ignores a stale decode %s after a healthy retry without replacing its cache",
    async (completion) => {
      const stale = deferred<{ duration: number }>();
      const engine = await import("./engine.ts");
      engine.unlockAudio();
      currentContext().decodeAudioData.mockImplementationOnce(
        () => stale.promise,
      );
      const first = engine.playClip(mat);
      await vi.advanceTimersByTimeAsync(2000);
      await expect(first).resolves.toBe(false);

      const retry = engine.playClip(mat);
      await vi.advanceTimersByTimeAsync(0);
      expect(currentContext().sources).toHaveLength(1);
      currentSource().onended?.();
      await expect(retry).resolves.toBe(true);
      if (completion === "resolve") stale.resolve({ duration: 99 });
      else stale.reject(new Error("Late decode failure"));
      await vi.advanceTimersByTimeAsync(0);
      expect(currentContext().sources).toHaveLength(1);

      const cached = engine.playClip(mat);
      await vi.advanceTimersByTimeAsync(0);
      expect(currentSource().buffer?.duration).toBe(0.25);
      currentSource().onended?.();
      await expect(cached).resolves.toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(currentContext().decodeAudioData).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledOnce();
    },
  );

  it.each(["before unlock", "fetch", "decode"])(
    "retries playback after a hanging preload (%s)",
    async (stage) => {
      const engine = await import("./engine.ts");
      if (stage !== "before unlock") engine.unlockAudio();
      if (stage === "decode") {
        currentContext().decodeAudioData.mockImplementationOnce(
          () => new Promise(() => undefined),
        );
      } else {
        vi.mocked(fetch).mockImplementationOnce(
          () => new Promise(() => undefined),
        );
      }
      engine.preload([mat]);
      await vi.advanceTimersByTimeAsync(2000);
      expect(console.warn).toHaveBeenCalledOnce();
      if (stage === "before unlock") engine.unlockAudio();
      const playing = engine.playClip(mat);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(2);
      currentSource().onended?.();
      await expect(playing).resolves.toBe(true);
    },
  );

  it("shares one 2000 ms deadline across a preload's fetch and decode", async () => {
    const downloading = deferred<Response>();
    vi.mocked(fetch).mockImplementationOnce(() => downloading.promise);
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    currentContext().decodeAudioData.mockImplementationOnce(
      () => new Promise(() => undefined),
    );
    engine.preload([mat]);
    await vi.advanceTimersByTimeAsync(1500);
    downloading.resolve(response());
    await vi.advanceTimersByTimeAsync(0);
    const result = vi.fn();
    const playing = engine.playClip(mat).then(result);
    await vi.advanceTimersByTimeAsync(499);
    expect(result).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await playing;
    expect(result).toHaveBeenCalledWith(false);
    expect(fetch).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledOnce();
    const retry = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(retry).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("settles false on fetch, HTTP, and decode errors and retries failed loads", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
    await expect(engine.playClip(mat)).resolves.toBe(false);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(engine.playClip(mat)).resolves.toBe(false);
    currentContext().decodeAudioData.mockRejectedValueOnce(
      new Error("Bad MP3"),
    );
    await expect(engine.playClip(mat)).resolves.toBe(false);
    expect(console.warn).toHaveBeenCalledOnce();
    const playing = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(playing).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("times out playback at duration plus 500 ms", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const result = vi.fn();
    const playing = engine.playClip(mat).then(result);
    await vi.advanceTimersByTimeAsync(749);
    expect(result).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await playing;
    expect(result).toHaveBeenCalledWith(false);
    expect(currentSource().stop).toHaveBeenCalledOnce();
  });

  it("skips a suspended context immediately when no resume is pending", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    currentContext().state = "suspended";
    await expect(engine.playClip(mat)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("waits for a pending resume before loading", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const context = currentContext();
    context.state = "suspended";
    let finishResume: () => void = () => undefined;
    context.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = resolve;
        }),
    );
    engine.unlockAudio();
    const playing = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetch).not.toHaveBeenCalled();
    context.state = "running";
    finishResume();
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(playing).resolves.toBe(true);
  });

  it("bounds a pending resume to 500 ms and never queues a late voice", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const context = currentContext();
    context.state = "suspended";
    let finishResume: () => void = () => undefined;
    context.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = resolve;
        }),
    );
    engine.unlockAudio();
    const result = vi.fn();
    const playing = engine.playClip(mat).then(result);
    await vi.advanceTimersByTimeAsync(499);
    expect(result).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await playing;
    expect(result).toHaveBeenCalledWith(false);
    context.state = "running";
    finishResume();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("swallows resume rejection, clears it, and permits a later gesture", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const context = currentContext();
    context.state = "suspended";
    context.resume.mockRejectedValueOnce(new Error("Gesture required"));
    engine.unlockAudio();
    await expect(engine.playClip(mat)).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    await expect(engine.playClip(mat)).resolves.toBe(false);
    engine.unlockAudio();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(engine.audioContextIfRunning()).toBe(context);
  });

  it("expires a hung resume so later calls skip it and another gesture can retry", async () => {
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const context = currentContext();
    context.state = "suspended";
    context.resume.mockImplementationOnce(() => new Promise(() => undefined));
    engine.unlockAudio();
    const first = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(500);
    await expect(first).resolves.toBe(false);
    await expect(engine.playClip(mat)).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    engine.unlockAudio();
    const retry = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(retry).resolves.toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it("does not let an older resume clear the pending promise of a newer gesture", async () => {
    const stale = deferred<undefined>();
    const healthy = deferred<undefined>();
    const engine = await import("./engine.ts");
    engine.unlockAudio();
    const context = currentContext();
    context.state = "suspended";
    context.resume
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => healthy.promise);
    engine.unlockAudio();
    await vi.advanceTimersByTimeAsync(100);
    engine.unlockAudio();
    stale.resolve(undefined);
    await vi.advanceTimersByTimeAsync(0);
    const playing = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).not.toHaveBeenCalled();
    context.state = "running";
    healthy.resolve(undefined);
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(playing).resolves.toBe(true);
  });

  it("preloads into the same cache without playing any voice", async () => {
    const engine = await import("./engine.ts");
    engine.preload([mat]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances).toHaveLength(0);
    engine.unlockAudio();
    engine.preload([mat, mat, { kind: "word", id: "missing" }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(currentContext().sources).toHaveLength(0);
    const playing = engine.playClip(mat);
    await vi.advanceTimersByTimeAsync(0);
    currentSource().onended?.();
    await expect(playing).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
