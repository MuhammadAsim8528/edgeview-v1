import assert from 'node:assert/strict';
import { readShipmentGrouping, saveShipmentGrouping } from '../../src/utils/viewPreferences';

const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
assert.equal(readShipmentGrouping(storage), true);
assert.equal(saveShipmentGrouping(false, storage), true);
assert.equal(readShipmentGrouping(storage), false);
assert.equal(saveShipmentGrouping(true, storage), true);
assert.equal(readShipmentGrouping(storage), true);
assert.equal(values.size, 1);
for (const value of ['garbage', '{"grouped":false}', '', 'false']) {
  values.set('edgeview_file_grouping_v1', value);
  assert.equal(readShipmentGrouping(storage), true);
}
const denied = { getItem: () => { throw new Error('Storage denied'); }, setItem: () => { throw new Error('Storage denied'); } };
assert.equal(readShipmentGrouping(denied), true);
assert.equal(saveShipmentGrouping(false, denied), false);
console.log('PASS bounded display preference round-trip, invalid state and denied browser storage');
