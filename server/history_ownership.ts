import { getDb } from './sqlite';

// Existing shipment rows have no provable dataset ID. Preserve them rather
// than assign ownership from a mutable, non-unique display filename.
export async function hasUnattributedHistory(fileName: string): Promise<boolean> {
  const row = await (await getDb()).get(
    "SELECT COUNT(*) AS count FROM history_data WHERE file_name = ? AND (file_id IS NULL OR file_id = '')", [fileName]);
  return Number(row?.count) > 0;
}

export const HISTORY_RECONCILIATION_REQUIRED = {
  success: false, code: 'LEGACY_HISTORY_RECONCILIATION_REQUIRED', recoverable: false,
  message: 'Older shipment history needs ownership reconciliation before this file can be deleted. Your data has been retained.',
};
