import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Contacts } from '../../src/components/Contacts';
import { SummaryCards } from '../../src/components/SummaryCards';
import { contactResearchCategory, matchesResearchFilter } from '../../shared/contact_research_scope';
import type { CompanyContact } from '../../src/types';

const make = (id: string, data: Partial<CompanyContact> = {}): CompanyContact => ({
  id, company_name: `SYN-${id}`, type: 'Importer', country: 'Kenya', ceo: '', email: '', phone: '', whatsapp: '', linkedin: '', message_sent: false, last_updated: '', ...data,
});
const contacts = [make('fresh'), make('details', { edgeview_v1_run_id: 'r1', website: 'https://company.test' }),
  make('weak', { edgeview_v1_run_id: 'r2' }), make('excluded', { type: 'Exporter', country: 'Pakistan' }),
  make('excluded-researched', { type: 'Exporter', country: 'Pakistan', edgeview_v1_run_id: 'r3', email: 'office@company.test' }),
  make('both', { type: 'Both', country: 'Pakistan' })];
const expected: Record<string, string[]> = { ALL: contacts.map(c => c.id), RESEARCHED: ['details', 'weak'], ENRICHED: ['details'],
  UNRESOLVED: ['weak'], UNRESEARCHED: ['fresh', 'both'], EXCLUDED: ['excluded', 'excluded-researched'], EXPORTER: ['excluded', 'excluded-researched', 'both'], IMPORTER: ['fresh', 'details', 'weak', 'both'] };
const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  for (const [filter, ids] of Object.entries(expected)) {
    assert.deepEqual(contacts.filter(c => matchesResearchFilter(c, filter)).map(c => c.id), ids, `${filter} scope`);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'edgeview_contacts_filter' ? filter : null, setItem() {} } });
    const markup = renderToStaticMarkup(<Contacts contacts={contacts} />);
    for (const c of contacts) assert.equal(markup.includes(`>${c.company_name}<`), ids.includes(c.id), `${filter} actually renders correct row: ${c.id}`);
  }
  assert.deepEqual(contacts.filter(c => contactResearchCategory(c) === 'UNRESOLVED').map(c => c.id), ['weak'], 'bulk retry excludes untouched and excluded records');
  let chosen = '';
  const tree = SummaryCards({ data: { total_companies: 6, contacts_found: 1, excluded_exporters: 2 }, onFilterClick: filter => { chosen = filter; } }) as React.ReactElement<any>;
  const excludedCard = tree.props.children.find((card: React.ReactElement<any>) => card.props['aria-label'] === 'Excluded Exporters');
  assert.equal(excludedCard.type, 'button', 'summary action must support native keyboard activation');
  excludedCard.props.onClick();
  assert.equal(chosen, 'EXCLUDED', 'excluded summary dispatches actual excluded filter, not unresearched');
  console.log('PASS actual Contacts initial rendered row matrix, excluded-card callback and retry classification; browser click/focus/effects NOT VERIFIED');
} finally {
  if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
  else delete (globalThis as any).localStorage;
}
