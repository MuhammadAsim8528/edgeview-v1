/** One idempotent normal-shutdown path. Fatal corruption must not use this. */
export function createShutdownController(options: {
  stopIntake: () => void;
  drain: () => Promise<unknown>;
  flush: () => Promise<void>;
  finish: (code: number) => void;
  report: (message: string) => void;
  drainMs?: number;
  deadlineMs?: number;
}) {
  let started: Promise<void> | undefined;
  return () => {
    if (started) return started;
    started = (async () => {
      let code = 0;
      const watchdog = setTimeout(() => {
        options.report('Shutdown deadline exceeded; restart recovery required.');
        options.finish(1);
      }, options.deadlineMs ?? 15000);
      let drainTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        options.stopIntake();
        const drained = await Promise.race([
          options.drain().then(() => true),
          new Promise<boolean>(resolve => { drainTimer = setTimeout(() => resolve(false), options.drainMs ?? 10000); }),
        ]);
        if (!drained) { code = 1; options.report('Shutdown drain timed out; unfinished work remains resumable, not completed.'); }
      } catch { code = 1; options.report('Shutdown drain failed; restart recovery required.'); }
      finally { if (drainTimer) clearTimeout(drainTimer); }
      try { await options.flush(); }
      catch { code = 1; options.report('Shutdown persistence flush failed; durable success is not claimed.'); }
      finally { clearTimeout(watchdog); }
      options.finish(code);
    })();
    return started;
  };
}
