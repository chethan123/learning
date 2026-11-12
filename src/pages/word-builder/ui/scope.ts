export interface Scope {
  readonly cancelled: boolean;
  /** Resolves after ms, or at once if cancelled. */
  sleep(ms: number): Promise<void>;
  /** Runs element.animate(...); resolves when it finishes or the scope is cancelled (the animation is then cancelled). Never rejects. */
  animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ): Promise<void>;
  /** Pending sleeps and animations resolve; cancelled becomes true. */
  cancel(): void;
}

/**
 * `scope.cancelled`, read through a call. A sequence checks its scope after
 * every await; TypeScript would otherwise keep the `false` it saw at the
 * first check and call the later checks unnecessary.
 */
export function isCancelled(scope: Scope): boolean {
  return scope.cancelled;
}

export function createScope(): Scope {
  let cancelled = false;
  /** One entry per pending sleep or animation: stops it and resolves it. */
  const pending = new Set<() => void>();

  return {
    get cancelled(): boolean {
      return cancelled;
    },

    sleep(ms: number): Promise<void> {
      if (cancelled) return Promise.resolve();
      return new Promise((resolve) => {
        const finish = (): void => {
          clearTimeout(timer);
          pending.delete(finish);
          resolve();
        };
        const timer = setTimeout(finish, ms);
        pending.add(finish);
      });
    },

    animate(
      element: Element,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
    ): Promise<void> {
      if (cancelled) return Promise.resolve();
      return new Promise((resolve) => {
        const settle = (): void => {
          pending.delete(stop);
          resolve();
        };
        let cancelAnimation: () => void = () => undefined;
        const stop = (): void => {
          // cancel() rejects `finished`; settle() is then a no-op.
          cancelAnimation();
          settle();
        };
        try {
          const animation = element.animate(keyframes, options);
          cancelAnimation = () => {
            animation.cancel();
          };
          pending.add(stop);
          animation.finished.then(settle, settle);
        } catch {
          // No Web Animations here (tests), or a keyframe the engine refuses.
          settle();
        }
      });
    },

    cancel(): void {
      cancelled = true;
      for (const stop of [...pending]) stop();
      pending.clear();
    },
  };
}
