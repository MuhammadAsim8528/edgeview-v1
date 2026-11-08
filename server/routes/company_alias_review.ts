import express from 'express';
import { db } from '../db';
import { getV1Run } from '../v1_engine';
import { prepareCompanyAliasAdmission } from '../company_alias_registry';

export const companyAliasReviewRouter = express.Router();
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,100}$/i.test(value);

/** Read-only review of existing records and immutable captures. This is not an
 * admission endpoint: nothing is grouped, persisted, refreshed or published. */
companyAliasReviewRouter.post('/:id/alias-review', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const body = req.body;
  if (!validId(req.params.id) || !body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 3
    || Object.keys(body).some(key => !['canonical_id', 'run_id', 'raw_record_id'].includes(key))
    || ![body.canonical_id, body.run_id, body.raw_record_id].every(validId)) {
    return res.status(400).json({ success: false, code: 'ALIAS_REVIEW_INPUT_INVALID',
      message: 'Choose existing company and saved evidence records.' });
  }
  const alias = db.getContactById(req.params.id);
  const canonical = db.getContactById(body.canonical_id);
  if (!alias || !canonical) return res.status(404).json({ success: false, code: 'ALIAS_RECORD_NOT_FOUND',
    message: 'One of the company records is no longer available.' });
  let run: ReturnType<typeof getV1Run>;
  try { run = getV1Run(body.run_id); }
  catch {
    return res.status(503).json({ success: false, code: 'ALIAS_EVIDENCE_UNREADABLE',
      message: 'Saved evidence could not be read. Inspect the research history or diagnostics.' });
  }
  if (!run) return res.status(404).json({ success: false, code: 'ALIAS_RUN_NOT_FOUND',
    message: 'The saved research run is no longer available.' });
  try {
    const plan = prepareCompanyAliasAdmission(alias, canonical, run, body.raw_record_id);
    const proof = JSON.parse(plan.row.proof_json);
    return res.json({ success: true, review_only: true, admitted: false, publication: 'NOT_APPLIED',
      alias_id: alias.id, canonical_id: canonical.id, confirmation_sha256: plan.confirmation_sha256, proof });
  } catch (error) {
    const code = String((error as { code?: unknown })?.code || '');
    return res.status(409).json({ success: false, review_only: true, admitted: false,
      code: /^ALIAS_[A-Z_]+$/.test(code) ? code : 'ALIAS_PROOF_REFUSED',
      message: 'Saved evidence does not establish an eligible local company alias. The records remain separate.' });
  }
});
