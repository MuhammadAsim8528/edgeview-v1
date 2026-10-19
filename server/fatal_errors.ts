/** Unknown process-level failures invalidate the in-memory operational state.
 * Log through the installed redacting logger and terminate without exporting
 * potentially corrupted database state. The normal launcher never auto-restarts.
 */
export function installFatalErrorHandlers(): void {
  let terminating = false;
  const terminate = (kind: string, error: unknown): never => {
    if (!terminating) {
      terminating = true;
      try { console.error(`EdgeView fatal ${kind}; restart required:`, error); } catch { /* logging cannot prevent exit */ }
    }
    process.exit(1);
  };
  process.on('uncaughtException', error => terminate('uncaught exception', error));
  process.on('unhandledRejection', error => terminate('unhandled rejection', error));
}
