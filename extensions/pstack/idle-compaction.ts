export const idleCompactTrigger = 80;
export const idleCompactRearm = 70;

export type IdleCompactionState = 'armed' | 'running' | 'disarmed' | 'closed';

export interface IdleCompactionContext {
  isIdle(): boolean;
  hasPendingMessages(): boolean;
  getContextUsage(): { percent: number | null } | undefined;
  compact(options: { onComplete?: () => void; onError?: (error: Error) => void }): void;
  model: { provider: string; id: string } | undefined;
  sessionManager: { getSessionId(): string };
}

const identity = (ctx: IdleCompactionContext) => JSON.stringify([ctx.sessionManager.getSessionId(), ctx.model?.provider, ctx.model?.id]);

const percentOf = (ctx: IdleCompactionContext) => {
  const percent = ctx.getContextUsage()?.percent;
  return typeof percent === 'number' && Number.isFinite(percent) ? percent : undefined;
};

const admissible = (ctx: IdleCompactionContext) => Boolean(ctx.model) && ctx.isIdle() && !ctx.hasPendingMessages();

/**
 * Optional idle-only compaction. Native automatic compaction and manual compaction stay
 * authoritative; this helper never aborts, resumes, retries, or injects work.
 */
export function createIdleCompaction(enabled: () => boolean) {
  let state: IdleCompactionState = 'armed';
  let current: string | undefined;
  let release: (() => void) | undefined;

  const finish = () => {
    if (state !== 'running') return;
    state = 'disarmed';
    const resolve = release;
    release = undefined;
    resolve?.();
  };

  return {
    state: () => state,
    reset() {
      if (state === 'closed' || state === 'running') return;
      state = 'armed';
      current = undefined;
    },
    close() {
      state = 'closed';
      const resolve = release;
      release = undefined;
      resolve?.();
    },
    /** Evaluate one final settlement. Returns a promise only while a requested compaction runs. */
    settled(ctx: IdleCompactionContext, aborted: boolean): Promise<void> | undefined {
      if (state === 'closed' || aborted || !enabled()) return undefined;
      const next = identity(ctx);
      if (next !== current) {
        current = next;
        if (state === 'disarmed') state = 'armed';
      }
      if (!admissible(ctx)) return undefined;
      const percent = percentOf(ctx);
      if (percent === undefined) return undefined;
      if (state === 'disarmed' && percent <= idleCompactRearm) state = 'armed';
      if (state !== 'armed' || percent < idleCompactTrigger) return undefined;
      state = 'running';
      const done = new Promise<void>(resolve => { release = resolve; });
      ctx.compact({ onComplete: finish, onError: finish });
      return done;
    },
  };
}
