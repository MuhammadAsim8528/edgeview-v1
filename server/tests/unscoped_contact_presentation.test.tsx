import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceEvidenceModal } from '../../src/components/SourceEvidenceModal';
import type { CompanyContact } from '../../src/types';

const contact: CompanyContact = { id: 'synthetic-scope', company_name: 'Scopeanchor Medical', type: 'Importer',
  country: 'Kenya', ceo: '', email: '', phone: '', whatsapp: '', linkedin: '', message_sent: false, last_updated: '',
  unscoped_facts: [{ field: 'email', value: 'unscoped@scopeanchor.test <img src=x onerror=alert(1)>',
    source_result_id: 'synthetic-source', source_url: 'https://scopeanchor.test/contact', quote: '', scope: 'unknown',
    reason: 'COUNTRY_SCOPE_UNPROVEN', target_country: 'Kenya' }] };
const markup = renderToStaticMarkup(<SourceEvidenceModal isOpen onClose={() => {}} contact={contact} />);
assert.ok(markup.includes('Country scope not established (1)'));
assert.ok(markup.includes('not listed as local contacts'));
assert.ok(markup.includes('Source: '));
assert.ok(markup.includes('&lt;img'));
assert.ok(!markup.includes('<img src=x'));
assert.ok(!markup.includes('mailto:unscoped@'));
assert.equal(contact.email, '', 'viewing unscoped evidence cannot fill the trusted email field');
const stale = renderToStaticMarkup(<SourceEvidenceModal isOpen onClose={() => {}} contact={{ ...contact, unscoped_facts: [], research_validation_status: 'needs_revalidation' }} />);
assert.ok(stale.includes('Previous research needs company-country revalidation'));
assert.ok(stale.includes('role="status"'));
console.log('PASS static modal notice, escaped retained facts and no local-email promotion; browser interaction NOT VERIFIED');
