import type { RequestHandler } from 'express';

let activeWork = 0;
let changingIdentity = false;

export class CompanyIdentityBusyError extends Error {
  readonly status = 409;
  readonly code = 'COMPANY_IDENTITY_BUSY';
  constructor() {
    super('Company identity changes must wait for current work to finish. Retry shortly.');
    this.name = 'CompanyIdentityBusyError';
  }
}

/** In-process coordination under the existing single backend/database owner.
 * This is not another identity registry, persistence authority or job owner. */
export function acquireCompanyIdentityWork(): () => void {
  if (changingIdentity) throw new CompanyIdentityBusyError();
  activeWork++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeWork--;
  };
}

export async function withCompanyIdentityWork<T>(operation: () => T | Promise<T>): Promise<T> {
  const release = acquireCompanyIdentityWork();
  try { return await operation(); } finally { release(); }
}

/** No waiting queue or force cancellation. A refused attempt performs no work.
 * The caller must still re-read/confirm proof and publish only after durability.
 * Ordinary work cannot be started recursively from an exclusive change. */
export async function withCompanyIdentityChange<T>(operation: () => T | Promise<T>): Promise<T> {
  if (changingIdentity || activeWork > 0) throw new CompanyIdentityBusyError();
  changingIdentity = true;
  try { return await operation(); } finally { changingIdentity = false; }
}

/** Await the handler's actual work. Response finish/close is not a work barrier:
 * providers/persistence may still be running after a client disconnects. */
export function identityWorkHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    void withCompanyIdentityWork(() => handler(req, res, next)).catch(next);
  };
}
