export class OperationCancelledError extends Error {
  readonly code: string;
  constructor(code = 'OPERATION_CANCELLED') {
    super(code);
    this.name = 'OperationCancelledError';
    this.code = code;
  }
}

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new OperationCancelledError();
}

export function createDeadlineSignal(parent: AbortSignal | undefined, timeoutMs: number, code: string) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) throw new Error('Invalid operation deadline.');
  const controller = new AbortController();
  const onParentAbort = () => {
    clearTimeout(timer);
    controller.abort(parent?.reason ?? new OperationCancelledError());
  };
  if (parent?.aborted) onParentAbort();
  else parent?.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new OperationCancelledError(code)), timeoutMs);
  timer.unref?.();
  const timeout = new Promise<never>((_, reject) => {
    const onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  // Owners may use signal-only control flow. Never leave the deadline's
  // rejection unobserved when cancellation is intentionally handled there.
  void timeout.catch(() => {});
  const cleanup = () => {
    clearTimeout(timer);
    parent?.removeEventListener('abort', onParentAbort);
  };
  return { signal: controller.signal, timeout, cleanup };
}

let activeCount = 0;
const waitingQueue: Array<() => void> = [];

export async function withBoundedConcurrency<T>(limit: number, operation: () => Promise<T>): Promise<T> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid concurrency limit.');
  if (activeCount >= limit) {
    await new Promise<void>((resolve) => waitingQueue.push(resolve));
  }
  activeCount++;
  try {
    return await operation();
  } finally {
    activeCount--;
    const next = waitingQueue.shift();
    if (next) next();
  }
}

export function waitForAbort(signal: AbortSignal, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); resolve(); }, timeoutMs);
    timer.unref?.();
    const onAbort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}
