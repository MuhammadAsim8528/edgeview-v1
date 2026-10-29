import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Process birth identity, not hardware identity. Unavailable inspection fails closed. */
export function processBirthIdentity(pid: number, onUnavailable?: (reason: 'TIMEOUT' | 'UNAVAILABLE' | 'MALFORMED') => void): string | null {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === 'win32') {
      const windowsRoot = process.env.SystemRoot || 'C:\\Windows';
      const executable = path.join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const value = execFileSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        `$ErrorActionPreference='Stop'; $p=[System.Diagnostics.Process]::GetProcessById(${pid}); try { [Console]::Out.Write($p.StartTime.ToUniversalTime().Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)) } finally { $p.Dispose() }`],
      // Avoid Get-Process cmdlet auto-discovery in the minimal child environment.
      // Use the loaded framework API directly, as the existing DPAPI adapter does.
      { timeout: 15000, maxBuffer: 4096, windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        env: { SystemRoot: windowsRoot, WINDIR: windowsRoot } }).trim();
      if (/^\d{10,}$/.test(value)) return `windows:${value}`;
      onUnavailable?.('MALFORMED');
      return null;
    }
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      // comm can contain spaces and parentheses; fields after its final ')' start at field 3.
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
      return /^\d+$/.test(fields[19] || '') ? `linux:${boot}:${fields[19]}` : null;
    }
  } catch (error) {
    // Only bounded classifications may reach acceptance diagnostics; never the
    // command, environment, raw exception or filesystem paths.
    onUnavailable?.((error as NodeJS.ErrnoException)?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'UNAVAILABLE');
  }
  return null;
}

export function recordedOwnerWasReused(record: unknown, pid: number, currentBirth: string | null): boolean {
  if (!record || typeof record !== 'object' || !currentBirth) return false;
  const owner = record as { pid?: unknown; birth?: unknown };
  const validBirth = /^(?:windows:\d{10,}|linux:[a-f0-9-]{36}:\d+)$/;
  return owner.pid === pid && typeof owner.birth === 'string' && validBirth.test(owner.birth)
    && validBirth.test(currentBirth) && owner.birth.split(':')[0] === currentBirth.split(':')[0]
    && owner.birth !== currentBirth;
}
