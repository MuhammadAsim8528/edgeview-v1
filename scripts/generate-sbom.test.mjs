import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateSbom } from './generate-sbom.mjs';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-sbom-'));
const destination = path.join(temp, 'inventory.json');
const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
try {
  fs.writeFileSync(destination, 'previous');
  assert.throws(() => generateSbom(destination, () => ({ status: 1 }))); assert.equal(fs.readFileSync(destination, 'utf8'), 'previous');
  assert.throws(() => generateSbom(destination, () => ({ status: 0, stdout: '{}' }))); assert.equal(fs.readFileSync(destination, 'utf8'), 'previous');
  assert.throws(() => generateSbom(destination, () => ({ status: 0, stdout: 'not-json' }))); assert.equal(fs.readFileSync(destination, 'utf8'), 'previous');
  assert.throws(() => generateSbom(destination, () => ({ status: 0, stdout: JSON.stringify({ bomFormat: 'CycloneDX', metadata: { component: { name: 'edgeview', purl: 'pkg:npm/other@1.0.0', version: '1.0.0' } }, components: [] }) })));
  const result = generateSbom(destination, () => ({ status: 0, stdout: JSON.stringify({ bomFormat: 'CycloneDX', metadata: { component: { name: 'checkout-folder', purl: `pkg:npm/edgeview@${version}`, version } }, components: [{ name: 'fixture', version: '1' }] }) }));
  assert.equal(result.components, 1); assert.equal(JSON.parse(fs.readFileSync(destination, 'utf8')).bomFormat, 'CycloneDX');
  const collision = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(collision, 'unrelated existing temporary file');
  assert.throws(() => generateSbom(destination, () => ({ status: 0, stdout: fs.readFileSync(destination, 'utf8') })));
  assert.equal(fs.readFileSync(collision, 'utf8'), 'unrelated existing temporary file');
  console.log('PASS standard SBOM adapter and previous-inventory preservation');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
