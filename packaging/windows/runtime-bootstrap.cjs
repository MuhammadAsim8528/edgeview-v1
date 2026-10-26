'use strict';

// Stage beside dist in the runtime package. The owning Windows launcher keeps
// stdin piped, sends one fixed shutdown command, and observes the real exit code.
// No network endpoint, dynamic executable/module name, or shell interpreter.
const path = require('node:path');
let requested = false;
let delivered = false;
let line = '';
let discard = false;

function deliverShutdown() {
  if (!requested || delivered || process.listenerCount('SIGTERM') === 0) return;
  delivered = true;
  process.removeListener('newListener', listenerAdded);
  process.emit('SIGTERM');
}
function requestShutdown() {
  requested = true;
  deliverShutdown();
}
function listenerAdded(event) {
  // newListener fires before the listener is installed. Defer so an early
  // close during startup reaches the actual backend shutdown controller.
  if (event === 'SIGTERM' && requested) queueMicrotask(deliverShutdown);
}
process.on('newListener', listenerAdded);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  for (const character of chunk) {
    if (character === '\n') {
      if (!discard && line.replace(/\r$/, '') === 'shutdown') requestShutdown();
      line = '';
      discard = false;
    } else if (!discard) {
      if (line.length < 32) line += character;
      else { line = ''; discard = true; }
    }
  }
});
// Losing the owner is a normal shutdown request, not permission to kill a
// process midway through durable writes. Existing backend deadlines still apply.
process.stdin.once('end', requestShutdown);
process.stdin.once('error', requestShutdown);
require(path.join(__dirname, 'dist', 'server.cjs'));
