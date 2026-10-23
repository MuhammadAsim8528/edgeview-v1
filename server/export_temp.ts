import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateExportFilenamePart } from './export_validation';

/** Download names never participate in disk paths. One owned directory per export. */
export class ExportTemporaryFiles {
  private root: string | undefined;
  private readonly names = new Map<string, string>();
  constructor(private readonly parent = os.tmpdir()) {}

  async write(name: string, data: Buffer | string): Promise<string> {
    validateExportFilenamePart(name);
    this.root ||= fs.mkdtempSync(path.join(this.parent, 'edgeview_exports-'));
    const target = path.join(this.root, `${randomUUID()}.tmp`);
    // Record before writing so even a partially failed write remains owned.
    this.names.set(target, name);
    await fs.promises.writeFile(target, data, { flag: 'wx' });
    return target;
  }

  nameFor(target: string): string {
    const name = this.names.get(target);
    if (name === undefined) throw new Error('Unknown temporary export artifact.');
    return name;
  }

  cleanup(): void {
    if (!this.root) return;
    // Only a directory created by this instance, never a request-selected path.
    fs.rmSync(this.root, { recursive: true, force: true });
    this.root = undefined;
    this.names.clear();
  }
}
