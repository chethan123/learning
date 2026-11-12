// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createScope, isCancelled, type Scope } from "./scope.ts";

/** Lets every promise continuation that is ready run. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Replaces element.animate with a stand-in whose animation the test finishes
 * or the scope cancels. Only `finished` and `cancel` are used by the scope.
 */
function fakeAnimate(element: Element): {
  readonly started: ReturnType<typeof vi.fn>;
  readonly finish: () => void;
  readonly cancel: ReturnType<typeof vi.fn>;
} {
  let resolve: () => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const finished = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const cancel = vi.fn(() => {
    reject(new Error("AbortError"));
  });
  const started = vi.fn(() => ({ finished, cancel }));
  Object.defineProperty(element, "animate", { value: started });
  return {
    started,
    finish: () => {
      resolve();
    },
    cancel,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("sleep", () => {
  it("resolves after the given time", async () => {
    const scope = createScope();
    const done = vi.fn();
    void scope.sleep(100).then(done);
    await vi.advanceTimersByTimeAsync(99);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledOnce();
    expect(scope.cancelled).toBe(false);
  });

  it("resolves on cancel, without waiting", async () => {
    const scope = createScope();
    const done = vi.fn();
    void scope.sleep(60_000).then(done);
    await settle();
    expect(done).not.toHaveBeenCalled();
    scope.cancel();
    await settle();
    expect(done).toHaveBeenCalledOnce();
    expect(scope.cancelled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves at once in a scope that is already cancelled", async () => {
    const scope = createScope();
    scope.cancel();
    const done = vi.fn();
    void scope.sleep(60_000).then(done);
    await settle();
    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("can be cancelled twice", () => {
    const scope = createScope();
    scope.cancel();
    expect(() => {
      scope.cancel();
    }).not.toThrow();
    expect(isCancelled(scope)).toBe(true);
  });
});

describe("animate", () => {
  it("resolves when the animation finishes", async () => {
    const scope = createScope();
    const element = document.createElement("div");
    const fake = fakeAnimate(element);
    const done = vi.fn();
    void scope.animate(element, [{ opacity: 0 }], { duration: 100 }).then(done);
    await settle();
    expect(done).not.toHaveBeenCalled();
    fake.finish();
    await settle();
    expect(done).toHaveBeenCalledOnce();
    expect(fake.cancel).not.toHaveBeenCalled();
  });

  it("cancels the animation and resolves when the scope is cancelled", async () => {
    const scope = createScope();
    const element = document.createElement("div");
    const fake = fakeAnimate(element);
    const done = vi.fn();
    const failed = vi.fn();
    void scope
      .animate(element, [{ opacity: 0 }], { duration: 100 })
      .then(done, failed);
    scope.cancel();
    await settle();
    expect(fake.cancel).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
  });

  it("does not start an animation in a cancelled scope", async () => {
    const scope = createScope();
    scope.cancel();
    const element = document.createElement("div");
    const fake = fakeAnimate(element);
    await scope.animate(element, [{ opacity: 0 }], { duration: 100 });
    expect(fake.started).not.toHaveBeenCalled();
  });

  it("resolves when the element cannot be animated", async () => {
    const scope = createScope();
    const element = document.createElement("div");
    Object.defineProperty(element, "animate", {
      value: () => {
        throw new TypeError("no animations here");
      },
    });
    await expect(
      scope.animate(element, [{ opacity: 0 }], { duration: 100 }),
    ).resolves.toBeUndefined();
  });
});

describe("a sequence that kept its own scope", () => {
  it("sees cancelled after the screen replaced its current scope", async () => {
    // The screen's one current scope, as the play screen holds it.
    let current: Scope = createScope();
    const steps: string[] = [];

    async function sequence(): Promise<void> {
      const scope = current; // taken once, at entry
      steps.push("start");
      await scope.sleep(1000);
      if (isCancelled(scope)) {
        steps.push("stopped");
        return;
      }
      steps.push("saved");
    }

    const running = sequence();
    // The free-play cycle button: cancel, then a fresh scope for later work.
    current.cancel();
    current = createScope();
    await running;

    expect(steps).toEqual(["start", "stopped"]);
    expect(current.cancelled).toBe(false);

    // A sequence started afterwards runs to its end on the fresh scope.
    const later = sequence();
    await vi.advanceTimersByTimeAsync(1000);
    await later;
    expect(steps).toEqual(["start", "stopped", "start", "saved"]);
  });
});
