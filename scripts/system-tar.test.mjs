import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { systemTar } from './system-tar.mjs';

const realPlatform = process.platform;
const realSystemRoot = process.env.SystemRoot;
const setPlatform = (value) => Object.defineProperty(process, 'platform', { value, configurable: true });

function withEnvironment(platform, systemRoot, run) {
  setPlatform(platform);
  if (systemRoot === null) delete process.env.SystemRoot;
  else process.env.SystemRoot = systemRoot;
  try { return run(); } finally {
    if (realSystemRoot === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = realSystemRoot;
    setPlatform(realPlatform);
  }
}

const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'edgeview-system-tar-'));
try {
  // On the host this runs on, the pin must be real: a Windows build never falls back to PATH tar
  // while System32 tar.exe exists.
  const onHost = systemTar();
  if (realPlatform === 'win32' && realSystemRoot && fs.existsSync(path.join(realSystemRoot, 'System32', 'tar.exe'))) {
    assert.equal(onHost, path.join(realSystemRoot, 'System32', 'tar.exe'), 'a Windows build must use the system archiver');
    assert.ok(path.isAbsolute(onHost) && fs.existsSync(onHost), 'the pinned archiver must be an existing absolute path');
    assert.notEqual(onHost, 'tar');
  } else {
    assert.equal(onHost, 'tar', 'a host without a system archiver uses PATH tar');
  }

  // Forced Windows with a SystemRoot that has no tar.exe must not return a path that cannot run.
  withEnvironment('win32', emptyRoot, () => {
    assert.equal(systemTar(), 'tar', 'a missing System32 tar.exe falls back to PATH tar');
  });
  withEnvironment('win32', null, () => {
    assert.equal(systemTar(), 'tar', 'an unset SystemRoot falls back to PATH tar instead of a relative path');
  });
  withEnvironment('linux', realSystemRoot ?? emptyRoot, () => {
    assert.equal(systemTar(), 'tar', 'a non-Windows build must not be pinned to a Windows binary');
  });
  withEnvironment('win32', realSystemRoot ?? path.join(process.env.SystemRoot || 'C:\\Windows'), () => {
    if (realSystemRoot && fs.existsSync(path.join(realSystemRoot, 'System32', 'tar.exe'))) {
      assert.notEqual(systemTar(), 'tar', 'the pin must survive a platform override when the archiver exists');
    }
  });
  console.log('PASS the archiver resolves to the existing System32 tar.exe on Windows, never to a path that cannot run, and stays on PATH elsewhere');
} finally {
  fs.rmSync(emptyRoot, { recursive: true, force: true });
  setPlatform(realPlatform);
  if (realSystemRoot === undefined) delete process.env.SystemRoot;
  else process.env.SystemRoot = realSystemRoot;
}
