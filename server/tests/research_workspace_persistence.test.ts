import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), '.test-cache', `workspace-${process.pid}-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
process.env.EDGEVIEW_TEST_MODE = '1';
process.env.EDGEVIEW_TEST_DB_DIR = dir;
process.env.EDGEVIEW_SQLITE_DB = path.join(dir, 'workspace.db');

const { ResearchWorkspace } = await import('../research_workspace');
const { resetDbInstanceForTests } = await import('../sqlite');

const first = await ResearchWorkspace.createOrGet({ company: 'Workspace Pharma Ltd', country: 'Kenya', force_fetch: true, context: { role: 'Importer' } });
const duplicate = await ResearchWorkspace.createOrGet({ company: 'Workspace Pharma Ltd', country: 'Kenya', force_fetch: true, context: { role: 'Importer' } });
assert.equal(first.created, true);
assert.equal(duplicate.created, false);
assert.equal(duplicate.campaign.id, first.campaign.id, 'compatible active request must attach to one campaign');

const taskId = await ResearchWorkspace.addTask(first.campaign.id, {
  objective: 'Leadership', capability: 'WEB_SEARCH', query: 'Workspace Pharma Kenya managing director', target_country: 'Kenya',
  reason: 'Resolve leadership', origin_agent: 'nvidia', preferred_providers: ['serper', 'exa', 'tavily'],
});
await ResearchWorkspace.reviewTask(first.campaign.id, taskId, 'groq', 'CHALLENGED', 'Require official source corroboration');
await Promise.all([
  ResearchWorkspace.appendEvent(first.campaign.id, 'PROVIDER_STARTED', 'provider', { provider: 'serper' }),
  ResearchWorkspace.appendEvent(first.campaign.id, 'PROVIDER_STARTED', 'provider', { provider: 'exa' }),
]);
const before = await ResearchWorkspace.get(first.campaign.id);
assert.ok(before);
assert.deepEqual(before!.events.map((event: any) => event.version), Array.from({ length: before!.version }, (_, index) => index + 1));
assert.equal(before!.tasks[0].review_status, 'CHALLENGED');

await new Promise((resolve) => setTimeout(resolve, 400));
resetDbInstanceForTests();
const reopened = await ResearchWorkspace.get(first.campaign.id);
assert.equal(reopened?.id, first.campaign.id);
assert.equal(reopened?.version, before!.version);
assert.equal(reopened?.tasks[0].reason, 'Require official source corroboration');
console.log('research_workspace_persistence.test.ts: PASS');
