/** Unknown process-level failures invalidate the in-memory operational state.
 * Log through the installed redacting logger and terminate without exporting
 * potentially corrupted database state. The normal launcher never auto-restarts.
 */
export type FatalKind = 'uncaught exception' | 'unhandled rejection';

export function installFatalErrorHandlers(report?: (kind: FatalKind) => void): void {
  let terminating = false;
  const terminate = (kind: FatalKind, error: unknown): never => {
    if (!terminating) {
      terminating = true;
      try { console.error(`EdgeView fatal ${kind}; restart required:`, error); } catch { /* logging cannot prevent exit */ }
      // The production callback may synchronously wait for a bounded isolated
      // reporter. Never yield this invalidated process back to application work.
      try { report?.(kind); } catch { /* reporting cannot prevent termination */ }
    }
    process.exit(1);
  };
  process.on('uncaughtException', error => terminate('uncaught exception', error));
  process.on('unhandledRejection', error => terminate('unhandled rejection', error));
}
