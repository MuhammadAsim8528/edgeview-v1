import crypto from 'node:crypto';
import { canonicalEntityIdentityKey, canonicalCountryIdentityKey } from './company_identity';
import { verifyCompanyAliasEvidence, COMPANY_ALIAS_PROOF_POLICY } from './company_alias_evidence';
import { getDb, getOperationalDatabaseStatus, type CompanyAliasRow } from './sqlite';
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

export type CompanyAliasRegistration =
  | { status: 'unlinked' }
  | { status: 'unavailable'; code: 'ALIAS_REGISTRATION_UNAVAILABLE' }
  | { status: 'invalid'; code: 'ALIAS_REGISTRATION_INVALID' }
  | { status: 'verified'; alias_id: string; canonical_id: string; country: string };

/** A persisted decision is not a blanket authorization to resolve names. Check
 * current source records, policy and immutable proof again before consumption.
 * Related rows exclude this row and identify either direction of a chain.
 * The synchronous snapshot does not authorize concurrent mutation/publication. */
export function validateCompanyAliasRegistration(row: CompanyAliasRow, contacts: ReadonlyArray<CompanyContact>,
  related: ReadonlyArray<CompanyAliasRow>, loadRun: (id: string) => V1Run | null): CompanyAliasRegistration {
  const invalid = (): CompanyAliasRegistration => ({ status: 'invalid', code: 'ALIAS_REGISTRATION_INVALID' });
  if (!row || typeof row.proof_json !== 'string' || Buffer.byteLength(row.proof_json, 'utf8') > 8192
    || ![row.alias_id, row.canonical_id].every(id => typeof id === 'string' && /^[a-z0-9-]{1,100}$/i.test(id))
    || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) return invalid();
  const aliases = contacts.filter(contact => contact.id === row.alias_id);
  const canonicals = contacts.filter(contact => contact.id === row.canonical_id);
  if (aliases.length !== 1 || canonicals.length !== 1 || related.some(item =>
    item.alias_id === row.alias_id || item.alias_key === row.alias_key
    || item.alias_id === row.canonical_id || item.alias_key === row.canonical_key
    || item.canonical_id === row.alias_id || item.canonical_key === row.alias_key)) return invalid();
  let proof: { policy_version?: unknown; run_id?: unknown; raw_record_id?: unknown };
  try { proof = JSON.parse(row.proof_json); } catch { return invalid(); }
  if (!proof || proof.policy_version !== COMPANY_ALIAS_PROOF_POLICY
    || ![proof.run_id, proof.raw_record_id].every(id => typeof id === 'string' && /^[a-z0-9-]{1,100}$/i.test(id))) return invalid();
  let run: V1Run | null;
  try { run = loadRun(String(proof.run_id)); }
  catch { return { status: 'unavailable', code: 'ALIAS_REGISTRATION_UNAVAILABLE' }; }
  if (!run) return { status: 'unavailable', code: 'ALIAS_REGISTRATION_UNAVAILABLE' };
  try {
    const current = prepareCompanyAliasAdmission(aliases[0], canonicals[0], run, String(proof.raw_record_id));
    if (!(Object.keys(current.row) as Array<keyof typeof current.row>).every(key => row[key] === current.row[key])) return invalid();
  } catch { return invalid(); }
  return { status: 'verified', alias_id: row.alias_id, canonical_id: row.canonical_id, country: row.country };
}

/** Read-only registry consumer. An unavailable operational store never becomes
 * an empty/approved registry, and this read must not initialize/migrate it. */
export async function readCompanyAliasRegistration(aliasId: string,
  contacts: () => ReadonlyArray<CompanyContact>, loadRun: (id: string) => V1Run | null): Promise<CompanyAliasRegistration> {
  if (getOperationalDatabaseStatus().status !== 'ok') return { status: 'unavailable', code: 'ALIAS_REGISTRATION_UNAVAILABLE' };
  try {
    const database = await getDb();
    const row = await database.get('SELECT * FROM company_aliases WHERE alias_id = ?', [aliasId]) as CompanyAliasRow | undefined;
    if (!row) return { status: 'unlinked' };
    const related = await database.all(`SELECT * FROM company_aliases
      WHERE alias_id = ? OR alias_key = ? OR canonical_id = ? OR canonical_key = ?`,
    [row.canonical_id, row.canonical_key, row.alias_id, row.alias_key]) as CompanyAliasRow[];
    return validateCompanyAliasRegistration(row, contacts(), related, loadRun);
  } catch { return { status: 'unavailable', code: 'ALIAS_REGISTRATION_UNAVAILABLE' }; }
}
