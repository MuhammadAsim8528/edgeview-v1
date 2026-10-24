// Only loaded by the isolated E2E child. Never import into the application.
const deny = () => { throw new Error('E2E_BACKEND_OUTBOUND_DISABLED'); };
for (const name of ['node:http', 'node:https']) {
  const transport = require(name);
  transport.request = deny;
  transport.get = deny;
}
globalThis.fetch = deny;
