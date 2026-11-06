import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRuntimeBackup } from '../shared/runtime_backup.mjs';

export { verifyRuntimeBackup } from '../shared/runtime_backup.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3 || process.argv.length > 4) throw new Error('Usage: node scripts/verify-runtime-backup.mjs <snapshot-directory> [expected-manifest-sha256]');
  console.log(JSON.stringify(await verifyRuntimeBackup(process.argv[2], process.argv[3])));
}
