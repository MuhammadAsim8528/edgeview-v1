import assert from 'node:assert/strict';
import { addDeterministicEvidenceFacts } from '../research_director';
import { EvidenceFusionEngine, EvidenceGraph } from '../research_fabric';

const graph = new EvidenceGraph();
const counts = addDeterministicEvidenceFacts(
  graph,
  [
    {
      url: 'https://slimpharma.com/contact/',
      content: [
        'SLIM PHARMACEUTICALS PVT LTD',
        'Head Office Address',
        '123 Hospital Road, Colombo 00700, Sri Lanka',
        'Email: info@slimpharma.com',
        'Phone: +94-11-268-1680',
      ].join('\n\n'),
    },
    {
      url: 'https://slimpharma.com/corporate-management/',
      content: 'Sumith Premaratne\nChairman',
    },
    {
      url: 'https://unrelated-directory.example/slim',
      content: 'Email: directory-owner@unrelated-directory.example\nPhone: +1 555 555 5555',
    },
  ],
  'SLIM PHARMACEUTICALS PVT LTD',
  'https://slimpharma.com/'
);

const fused = EvidenceFusionEngine.fuse(graph, 'SLIM PHARMACEUTICALS PVT LTD', 'Sri Lanka');
assert.ok(counts.emails >= 1, 'official email must be deterministically admitted');
assert.ok(counts.phones >= 1, 'official phone must be deterministically admitted');
assert.ok(counts.addresses >= 1, 'official address must be deterministically admitted');
assert.ok(counts.people >= 1, 'official leadership must be deterministically admitted');
assert.ok(fused.emails_list.includes('info@slimpharma.com'));
assert.ok(fused.phones_list.some((phone: string) => phone.includes('268-1680')));
assert.ok(fused.addresses.some((address: any) => String(address.address || address).includes('Colombo 00700')));
assert.ok(fused.contact_persons.some((person: any) => person.name === 'Sumith Premaratne' && person.designation === 'Chairman'));
assert.ok(!fused.emails_list.includes('directory-owner@unrelated-directory.example'));

console.log('slim_deterministic_evidence_regression.test.ts: PASS');
