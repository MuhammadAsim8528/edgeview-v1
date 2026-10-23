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
  const cards = contacts.map(c => `
      <div class="card">
        <h2 class="card-title">${escapeHtml(String(c.company_name ?? ''))}</h2>
        <div class="card-meta">Added: ${escapeHtml(new Date(c.first_seen || c.last_updated || Date.now()).toLocaleDateString())}</div>
        <div class="field"><span class="label">Industry:</span> ${display(c.industry)}</div>
        <div class="field"><span class="label">Website:</span> ${link(c.website)}</div>
        <div class="field"><span class="label">Email:</span> ${display(c.email)}</div>
        <div class="field"><span class="label">Phone:</span> ${display(c.phone)}</div>
        <div class="field"><span class="label">Address:</span> ${display(c.address)}</div>
        <div class="field"><span class="label">LinkedIn:</span> ${link(c.linkedin, 'View Profile')}</div>
      </div>
    `).join('');
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
