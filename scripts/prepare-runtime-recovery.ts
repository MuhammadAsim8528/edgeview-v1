import { copyLegacyRuntimeData } from '../server/legacy_data_migration';

const [snapshot, destination, manifestSha256, schema, ...extra] = process.argv.slice(2);
if (extra.length || !snapshot || !destination || !/^[a-f0-9]{64}$/.test(manifestSha256 || '') || !/^\d+$/.test(schema || '')) {
  console.error('Usage: node --import tsx scripts/prepare-runtime-recovery.ts <snapshot> <new-data-directory> <manifest-sha256> <expected-schema>');
  process.exitCode = 1;
} else {
  void copyLegacyRuntimeData(snapshot, destination, { manifestSha256, schema: Number(schema) }).then(result => {
    console.log(JSON.stringify(result));
  }).catch(() => {
    console.error('RECOVERY_COPY_REFUSED: Check the manifest hash, schema, free disk space and destination. Existing data was retained.');
    process.exitCode = 1;
  });
}
