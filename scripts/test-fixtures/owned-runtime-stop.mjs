// Test-process IPC only; never exposed through the product API or package launcher.
process.on('message', message => {
  if (message === 'edgeview-test-stop') process.emit('SIGTERM');
});
