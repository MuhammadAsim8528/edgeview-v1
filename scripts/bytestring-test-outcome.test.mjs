import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-bytestring-outcome-'));
const source = fs.readFileSync(path.join(root, 'server/tests/bytestring_credential_regression.test.ts'), 'utf8')
  .replace(/from '(\.\.\/[^']+)'/g, (_, relative) =>
    `from '${pathToFileURL(path.resolve(root, 'server/tests', `${relative}.ts`)).href}'`);
const marker = "  const result = await fetchProviderModels('nvidia', maskKey(syntheticStored), undefined, true);";
assert.equal(source.split(marker).length, 2, 'the probe must target the actual resolver call');
try {
  for (const [name, replacement, expected] of [
    ['normal', marker, 0],
    ['failed-resolution', "  throw new Error('SYNTHETIC_RESOLUTION_FAILURE');\n" + marker, 1],
    ['wrong-key', marker.replace('maskKey(syntheticStored)', "'synthetic-wrong-key'"), 1],
  ]) {
    const file = path.join(scratch, `${name}.test.mts`);
    fs.writeFileSync(file, source.replace(marker, replacement));
    const result = spawnSync(process.execPath, ['--import', 'tsx', file], {
      cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    assert.equal(result.error, undefined, `${name} must actually execute`);
    if (expected === 0) assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    else {
      assert.notEqual(result.status, 0, `${name} must fail instead of claiming successful resolution`);
      assert.match(result.stderr, name === 'failed-resolution'
        ? /SYNTHETIC_RESOLUTION_FAILURE/ : /catalog must receive the synthetic stored secret/);
    }
  }
  console.log('PASS normal credential regression; failed-resolution and wrong-key mutants rejected');
} finally {
  assert.equal(path.dirname(fs.realpathSync(scratch)), fs.realpathSync(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
}
