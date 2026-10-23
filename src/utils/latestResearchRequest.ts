import type { SafeFetchResult } from './safeFetch';

/** One replaceable read request. Even an abort-ignoring response cannot publish. */
export function createLatestResearchRequest(timeoutMs = 15_000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new Error('Invalid research read deadline.');
  let generation = 0;
  let active: { controller: AbortController; release: () => void } | undefined;
  const cancel = () => {
    generation++;
    const previous = active;
    active = undefined;
    previous?.release();
    previous?.controller.abort();
  };
  return {
    cancel,
    async run<T>(request: (signal: AbortSignal) => Promise<SafeFetchResult<T>>, publish: (result: SafeFetchResult<T>) => void) {
      cancel();
      const ticket = generation;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const interrupted = new Promise<SafeFetchResult<T> | undefined>(resolve => {
        active = { controller, release: () => resolve(undefined) };
        timer = setTimeout(() => {
          resolve({ ok: false, status: 0, data: null, code: 'RESEARCH_READ_TIMEOUT', error: 'Research information took too long to load. Please try again.' });
          controller.abort();
        }, timeoutMs);
      });
      try {
        const operation = Promise.resolve().then(() => controller.signal.aborted ? undefined : request(controller.signal)).catch((): SafeFetchResult<T> => ({ ok: false, status: 0, data: null, code: 'RESEARCH_READ_FAILED', error: 'Could not load research information. Please try again.' }));
        const result = await Promise.race([operation, interrupted]);
        if (result && ticket === generation) publish(result);
      } finally {
        clearTimeout(timer);
        if (ticket === generation) active = undefined;
      }
    },
  };
}
