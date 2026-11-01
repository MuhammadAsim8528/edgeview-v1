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

// Isolated compiled-runtime fault, enabled only by this E2E harness. The
// sql.js initializer shares its module promise with the real backend, so this
// intercepts the actual history SELECT without corrupting the stored database.
if (process.env.EDGEVIEW_TEST_MODE === '1' && process.env.EDGEVIEW_E2E_HISTORY_FAULT_FILE) {
  const fs = require('node:fs');
  require('sql.js')().then(SQL => {
    const prepare = SQL.Database.prototype.prepare;
    SQL.Database.prototype.prepare = function (sql, ...args) {
      if (String(sql).trim() === 'SELECT file_name, importer, exporter, country, item, tot_fc FROM history_data'
          && fs.existsSync(process.env.EDGEVIEW_E2E_HISTORY_FAULT_FILE)) throw new Error('SYNTHETIC_PRIVATE_HISTORY_FAILURE');
      return prepare.call(this, sql, ...args);
    };
  }).catch(() => { process.stderr.write('E2E history fault setup failed'); process.exitCode = 1; });
}
