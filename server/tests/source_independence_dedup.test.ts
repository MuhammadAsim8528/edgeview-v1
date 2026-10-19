// source_independence_dedup.test.ts
// Ensures that duplicate evidence from the same source family only counts once for corroboration.

import assert from 'assert';
import { EvidenceGraph } from '../research_fabric';

(async () => {
  const graph = new EvidenceGraph();
  // First email fact from a partner-host URL
  await graph.addFact(
    'email',
    'info@partner.com',
    'https://partner.com/page1',
    'partner_provider',
    'AI_EXTRACT',
    0.8
  );
  // Second email fact from another URL on the same partner host – same source family
  await graph.addFact(
    'email',
    'info@partner.com',
    'https://partner.com/page2',
    'partner_provider',
    'AI_EXTRACT',
    0.8
  );

  const factNode = graph.getFacts().find((n) => n.metadata.field === 'email');
  assert.ok(factNode, 'Email fact should exist');
  // Corroboration count should be 1 because both observations belong to the same source family.
  assert.strictEqual(
    factNode!.metadata.corroborationCount,
    1,
    'Corroboration count must be 1 for duplicate observations from the same source family'
  );

  console.log('✅ source_independence_dedup test passed');
})();
