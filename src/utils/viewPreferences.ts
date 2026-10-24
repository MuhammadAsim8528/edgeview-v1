const GROUPING_KEY = 'edgeview_file_grouping_v1';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readShipmentGrouping(storage?: PreferenceStorage): boolean {
  try { return (storage ?? globalThis.localStorage).getItem(GROUPING_KEY) !== 'off'; }
  catch { return true; }
}

/** One bounded display preference, never trade rows or provider evidence. */
export function saveShipmentGrouping(grouped: boolean, storage?: PreferenceStorage): boolean {
  try { (storage ?? globalThis.localStorage).setItem(GROUPING_KEY, grouped ? 'on' : 'off'); return true; }
  catch { return false; }
}
