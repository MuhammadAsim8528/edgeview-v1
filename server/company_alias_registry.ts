import crypto from 'node:crypto';
import { canonicalEntityIdentityKey, canonicalCountryIdentityKey } from './company_identity';
import { verifyCompanyAliasEvidence } from './company_alias_evidence';
import { getDb, type CompanyAliasRow } from './sqlite';
import type { CompanyContact } from './db';
import type { V1Run } from './v1_engine';

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const refuse = (code: string): never => { throw Object.assign(new Error(code), { code }); };

/** Internal backend admission plan. Callers resolve both IDs from the current
 * uploaded-record projection and the run from immutable storage. No HTTP route
 * may substitute client company records, source text or confidence here. */
export function prepareCompanyAliasAdmission(alias: CompanyContact, canonical: CompanyContact,
  run: V1Run, rawRecordId: string) {
  if (!alias || !canonical || !/^[a-zA-Z0-9-]{1,100}$/.test(alias.id)
    || !/^[a-zA-Z0-9-]{1,100}$/.test(canonical.id) || alias.id === canonical.id) return refuse('ALIAS_RECORDS_REQUIRED');
  if (alias.type !== canonical.type) return refuse('ALIAS_ROLE_REVIEW_REQUIRED');
  const aliasKey = canonicalEntityIdentityKey(alias.company_name, alias.country);
  const canonicalKey = canonicalEntityIdentityKey(canonical.company_name, canonical.country);
  if (!aliasKey || !canonicalKey || aliasKey === canonicalKey
    || (alias.entity_key && alias.entity_key !== aliasKey)
    || (canonical.entity_key && canonical.entity_key !== canonicalKey)) return refuse('ALIAS_RECORD_IDENTITY_REFUSED');
  const proof = verifyCompanyAliasEvidence(alias, canonical, run, rawRecordId);
  if (!proof.verified) return refuse(proof.code);
  const proofJson = JSON.stringify({ ...proof,
    alias_name: alias.company_name, canonical_name: canonical.company_name, role: alias.type });
  if (Buffer.byteLength(proofJson, 'utf8') > 8192) return refuse('ALIAS_PROOF_LIMIT');
  const row = { alias_id: alias.id, alias_key: aliasKey, canonical_id: canonical.id, canonical_key: canonicalKey,
    country: canonicalCountryIdentityKey(proof.country), proof_json: proofJson };
  return { row, confirmation_sha256: digest(JSON.stringify(row)) };
}

/** Internal insert-only storage boundary. It deliberately does not publish new
 * grouping/cache state. Consumer publication must follow this durable barrier. */
export async function persistCompanyAliasAdmission(plan: ReturnType<typeof prepareCompanyAliasAdmission>,
  expectedConfirmation: string): Promise<CompanyAliasRow> {
  if (!/^[a-f0-9]{64}$/.test(expectedConfirmation)
    || expectedConfirmation !== digest(JSON.stringify(plan.row))
    || expectedConfirmation !== plan.confirmation_sha256) return refuse('ALIAS_CONFIRMATION_CHANGED');
  // Copy before the await: caller-owned objects cannot change a queued write.
  const row = { ...plan.row, created_at: new Date().toISOString() };
  return (await getDb()).insertCompanyAliasDurably(row);
}
