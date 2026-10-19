// Deterministic diagnostic scanner for suspicious/synthetic company names.
// Used by regression tests and the post-cleanup global contamination scan.
// This is a DETECTOR, not a filter: exports are never mutated by these patterns
// so the root cause of contamination cannot be silently hidden.

export interface ProvenanceHit {
  type: 'company' | 'importer' | 'exporter';
  name: string;
  matchedBy: string;
}

export const SUSPICIOUS_NAME_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'numbered-placeholder', re: /^(IMPORTER|EXPORTER|IMPORT|EXPORT|BUYER|SELLER|COMPANY|CONTACT)\s*[0-9]{2,}$/i },
  { label: 'test-prefix', re: /^(TEST|MOCK|FAKE|SAMPLE|SYNTHETIC|FIXTURE|SEED|DEMO|DUMMY)[_\s-]/i },
  { label: 'timestamp-suffix', re: /^[A-Za-z]+_[0-9]{12,}$/ },
  { label: 'acadguard-test', re: /acadguard\s*test\s*company/i },
  { label: 'testpharma', re: /testpharma/i },
  { label: 'uncached-pharma', re: /uncachedpharma/i },
  { label: 'multicompany', re: /multicompany/i },
  { label: 'injection-target', re: /injectiontarget/i },
  { label: 'nonexistent', re: /nonexistent/i },
  { label: 'mem-regress', re: /mem-regress|global health importers ltd|pharma export global corp/i },
];

export function isSuspiciousCompanyName(name: string): string | null {
  const s = String(name || '').trim();
  if (!s) return null;
  for (const p of SUSPICIOUS_NAME_PATTERNS) {
    if (p.re.test(s)) return p.label;
  }
  return null;
}

export function scanCompanyNames(names: Array<string | { company_name?: string; name?: string; importer?: string; exporter?: string }>): ProvenanceHit[] {
  const hits: ProvenanceHit[] = [];
  for (const n of names) {
    if (typeof n === 'string') {
      const m = isSuspiciousCompanyName(n);
      if (m) hits.push({ type: 'company', name: n, matchedBy: m });
      continue;
    }
    if (n && typeof n === 'object') {
      if (n.company_name) {
        const m = isSuspiciousCompanyName(n.company_name);
        if (m) hits.push({ type: 'company', name: String(n.company_name), matchedBy: m });
      } else if (n.name) {
        const m = isSuspiciousCompanyName(n.name);
        if (m) hits.push({ type: 'company', name: String(n.name), matchedBy: m });
      }
      if (n.importer) {
        const m = isSuspiciousCompanyName(n.importer);
        if (m) hits.push({ type: 'importer', name: String(n.importer), matchedBy: m });
      }
      if (n.exporter) {
        const m = isSuspiciousCompanyName(n.exporter);
        if (m) hits.push({ type: 'exporter', name: String(n.exporter), matchedBy: m });
      }
    }
  }
  return hits;
}