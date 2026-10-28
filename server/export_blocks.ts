import { escapeHtml } from './export_manager';
import type { CompanyContact } from './db';

// Downloaded HTML can be opened outside the app CSP. URL admission and output
// escaping are separate boundaries: parsed HTTP(S) links still need escaping.
export function safeExportHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  const text = value.trim();
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const parsed = new URL(text);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname ? text : null;
  } catch { return null; }
}

type BlockContact = Partial<CompanyContact> & { first_seen?: string };
export function buildContactBlocksHtml(contacts: readonly BlockContact[]): string {
  const display = (value: unknown) => value ? escapeHtml(String(value)) : '<span class="empty">N/A</span>';
  const link = (value: unknown, label?: string) => {
    const href = safeExportHref(value);
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || href)}</a>` : display(value);
  };
  const strings = (values: unknown[]) => [...new Map(values.filter(value => typeof value === 'string' && value.trim())
    .map(value => [(value as string).trim().toLowerCase(), (value as string).trim()])).values()];
  const list = (values: string[]) => values.length ? `<ul>${values.map(value => `<li>${value}</li>`).join('')}</ul>` : display('');
  const field = (label: string, value: string) => `<div class="field"><span class="label">${escapeHtml(label)}:</span> ${value}</div>`;
  const cards = contacts.map(c => {
    const emails = strings([c.email, ...(Array.isArray(c.emails_list) ? c.emails_list : [])]);
    const phones = strings([c.phone, ...(Array.isArray(c.phones_list) ? c.phones_list : [])]);
    const addresses = Array.isArray(c.addresses) ? c.addresses.filter(value => value && typeof value.address === 'string' && value.address.trim()) : [];
    // Retain scalar-only legacy data without duplicating the primary array value.
    if (c.address && !addresses.some(value => value.address.trim().toLowerCase() === c.address!.trim().toLowerCase())) addresses.push({ address: c.address });
    const people = Array.isArray(c.contact_persons) ? c.contact_persons.filter(person => person && person.name) : [];
    const leadership = people.map(person => [display(person.name), person.designation && display(person.designation),
      person.department && display(person.department), person.email && display(person.email), person.phone && display(person.phone),
      person.country && display(person.country), person.branch && display(person.branch),
      person.linkedin_url && link(person.linkedin_url, 'Profile'), person.source_url && link(person.source_url, 'Source')].filter(Boolean).join(' — '));
    if (c.ceo && !people.some(person => person.name.trim().toLowerCase() === c.ceo!.trim().toLowerCase())) leadership.push(`${display(c.ceo)} — CEO`);
    const socials = Array.isArray(c.socials) ? c.socials.filter(social => social && social.url) : [];
    const linkedin = strings([c.linkedin, ...(Array.isArray(c.linkedin_urls) ? c.linkedin_urls : [])]);
    const sourceUrls = strings([
      ...(Array.isArray(c.sources) ? c.sources.map(source => source?.url) : []),
      ...(Array.isArray(c.evidence) ? c.evidence.map(item => item && typeof item === 'object' && 'source_url' in item ? item.source_url : undefined) : []),
      ...addresses.map(address => address.source_url), ...people.map(person => person.source_url), ...socials.map(social => social.source_url),
    ]);
    return `
      <div class="card">
        <h2 class="card-title">${escapeHtml(String(c.company_name ?? ''))}</h2>
        <div class="card-meta">Added: ${escapeHtml(new Date(c.first_seen || c.last_updated || Date.now()).toLocaleDateString())}</div>
        ${c.country ? field('Country', display(c.country)) : ''}
        ${c.type ? field('Role', display(c.type)) : ''}
        ${c.quality_status ? field('Research status', display(c.quality_status)) : ''}
        <div class="field"><span class="label">Industry:</span> ${display(c.industry)}</div>
        <div class="field"><span class="label">Website:</span> ${link(c.website)}</div>
        ${field('Email', list(emails.map(value => display(value))))}
        ${field('Phone', list(phones.map(value => display(value))))}
        ${field('Address', list(addresses.map(address => [address.type && display(address.type), display(address.address),
          address.source_url && link(address.source_url, 'Source')].filter(Boolean).join(' — '))))}
        ${field('LinkedIn', list(linkedin.map(value => link(value, 'View Profile'))))}
        ${leadership.length ? field('Leadership / contacts', list(leadership)) : ''}
        ${socials.length ? field('Social profiles', list(socials.map(social => link(social.url, social.platform || social.url)))) : ''}
        ${c.whatsapp ? field('WhatsApp', display(c.whatsapp)) : ''}
        ${sourceUrls.length ? field('Sources', list(sourceUrls.map(value => link(value)))) : ''}
      </div>
    `;
  }).join('');
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EdgeView Contact Block Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f3f4f6;
      color: #111827;
      margin: 0;
      padding: 32px;
    }
    h1 {
      text-align: center;
      margin-bottom: 32px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 8px;
    }
    .card-meta {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .field {
      margin-bottom: 12px;
      font-size: 0.95rem;
    }
    .field ul { margin: 4px 0 0; padding-left: 20px; }
    .field li { margin: 4px 0; overflow-wrap: anywhere; }
    a { overflow-wrap: anywhere; }
    .label {
      font-weight: 600;
      color: #374151;
      display: inline-block;
      min-width: 80px;
    }
    .empty {
      color: #9ca3af;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>EdgeView Exported Company Profiles</h1>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>
    `;
}
