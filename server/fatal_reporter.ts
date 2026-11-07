// Separate bounded process. No application, settings, database or evidence imports.
// Reuse the one outgoing privacy adapter; never accept an exception or stack.
import { initMonitoring, captureMonitoringEvent } from './monitoring';
import { projectMonitoringEvent } from '../shared/monitoring_privacy';

const deadline = setTimeout(() => process.exit(1), 2500);
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  if (Buffer.byteLength(input) > 2048) process.exit(2);
});
process.stdin.on('error', () => process.exit(2));
process.stdin.once('end', () => {
  void (async () => {
    try {
      const value = JSON.parse(input);
      if (!value || Object.keys(value).sort().join(',') !== 'identity,kind'
        || !['uncaught exception', 'unhandled rejection'].includes(value.kind)) process.exit(2);
      if (!projectMonitoringEvent('runtime_error', {}, value.identity)) process.exit(2);
      initMonitoring(value.identity, { errors: true, usage: false });
      const result = await captureMonitoringEvent('runtime_error', {
        stage: 'shutdown', outcome: 'failed', error_code: value.kind === 'uncaught exception'
          ? 'PROCESS_UNCAUGHT_EXCEPTION' : 'PROCESS_UNHANDLED_REJECTION',
      }, true);
      clearTimeout(deadline);
      process.exit(result.sentry ? 0 : 1);
    } catch { process.exit(2); }
  })();
});
