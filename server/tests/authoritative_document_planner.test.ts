import assert from 'node:assert/strict';
import { planAuthoritativeDocumentActions, planStableContactRecoveryActions } from '../research_runtime';
import { getAppSettings } from '../settings';

const settings = {
  ...getAppSettings(),
  serper_api_key: 'test-key',
  serper_enabled: true,
  tavily_api_key: '',
  tavily_enabled: false,
};
const companyState: any = { plannedQueries: [], hasAddress: false, hasLeadership: false };
const missing = ['email', 'phone', 'address', 'leadership'];
const actions = planAuthoritativeDocumentActions('Example Pharma Ltd', 'Kenya', missing, [], settings, companyState);
assert.equal(actions.length, 2, 'Authoritative document escalation is bounded to two actions');
assert.ok(actions.every((action) => action.provider_id === 'serper'));
assert.ok(actions.some((action) => /regulator|licensed importer/.test(action.query)));
assert.ok(actions.some((action) => /registry chamber/.test(action.query)));
assert.ok(actions.every((action) => /Example Pharma Ltd/.test(action.query) && /Kenya/.test(action.query)));

companyState.plannedQueries = actions;
assert.equal(
  planAuthoritativeDocumentActions('Example Pharma Ltd', 'Kenya', missing, [], settings, companyState).length,
  0,
  'Authoritative document strategy remains globally bounded and does not duplicate queued work',
);

const stable = planStableContactRecoveryActions('Example Pharma Ltd', 'Kenya', missing, [], 0, settings, {
  ...companyState,
  plannedQueries: [{ query: 'Example Pharma Ltd Kenya procurement purchasing sourcing manager contact email phone', status: 'pending' }],
});
assert.ok(!stable.some((action) => action.query === 'Example Pharma Ltd Kenya procurement purchasing sourcing manager contact email phone'));
assert.ok(stable.length <= 4, 'Stable role-family recovery remains bounded');

console.log('authoritative_document_planner: 8 assertions passed');
