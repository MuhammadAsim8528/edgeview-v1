// Only loaded by the isolated E2E child. Never import into the application.
const deny = () => {
  if (process.env.EDGEVIEW_E2E_EGRESS_AUDIT) require('node:fs').appendFileSync(process.env.EDGEVIEW_E2E_EGRESS_AUDIT, 'attempt\n');
  throw new Error('E2E_BACKEND_OUTBOUND_DISABLED');
};
for (const name of ['node:http', 'node:https']) {
  const transport = require(name);
  transport.request = deny;
  transport.get = deny;
}
globalThis.fetch = deny;
