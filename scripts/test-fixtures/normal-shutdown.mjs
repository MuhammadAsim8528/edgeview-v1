// Test-only IPC bridge: exercise the installed Node signal handler on Windows,
// where child.kill(SIGTERM) forcibly terminates without delivering that handler.
// Never loaded by the real launcher; no HTTP/control endpoint is introduced.
if (!process.send) throw new Error('Shutdown fixture requires an isolated IPC child');
process.on('message', message => {
  if (message === 'edgeview-test-normal-shutdown') process.emit('SIGTERM');
});
