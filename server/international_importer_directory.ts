// Canonical International Importer Directory projection.
//
// This module is the single source of truth for the EDGEVIEW — INTERNATIONAL
// IMPORTER DIRECTORY report. Every downstream artifact (PDF, DOCX, XLSX, CSV,
// ZIP, and the Contacts UI) derives from `getInternationalImporterDirectory()`
// so ordering, country normalization, Pakistan exclusion, deduplication, and
// trade aggregation are identical everywhere.
//
// Projection rules (concise, data-driven, no fabrication):
//   - Only companies that act as importers are included (type Exporter-only is
//     excluded; Importer / Both / untyped are retained).
//   - Pakistan (PK/PAK/Pakistan and variants) is excluded from the directory.
//   - Countries are normalized deterministically (ISO alpha-2/alpha-3 + common
//     spellings) and sorted A→Z ("Not Specified" last); only countries that
//     actually have importers appear — no empty sections.
//   - Importers within a country are sorted A→Z (case-insensitive).
//   - "Traded With" is a bullet list of the UNIQUE partner company names that
//     appear in the actual shipment records, deduplicated case-insensitively,
//     ordered by transaction count (desc) then alphabetically. No invented
//     partners, no shipment-by-shipment history.
//   - "Top Products" is a deterministic frequency ranking computed from the
//     actual item descriptions (count desc, alphabetical tie-break), limited to
//     Top 5 by default and never more than Top 10.
//   - Contact / leadership fields are DYNAMIC: only values that actually exist
//     are shown. Missing fields are omitted (never "Not found" placeholders).
//   - Sources are kept concise ("Source: x" / "Sources: a; b"). The underlying
//     record continues to store full provenance (URL/type/confidence/evidence).
//   - No data is fabricated.

import { TradeRelationshipResolver } from './trade_relationship_resolver';
import { mergeContacts, normalizePeople, normalizeContactInfo, type TradeIndex } from './contact_report_model';
import type { ReportCompanyContact } from './docx_report';
import { normalizeCountryName, isPakistanCountry } from '../src/utils/countryNormalizer';

export const INTERNATIONAL_IMPORTER_DIRECTORY_TITLE = 'EDGEVIEW — INTERNATIONAL IMPORTER DIRECTORY';

/** Top products shown by default. */
export const DEFAULT_TOP_PRODUCTS_LIMIT = 5;
/** Hard ceiling for the top-products list (never exceeded). */
export const MAX_TOP_PRODUCTS_LIMIT = 10;
/** Hard ceiling for unique trading-partner companies shown (never exceeded). */
export const MAX_TRADED_WITH = 10;

export interface InternationalImporterRow {
  country: string;
  importer: string;
  /** Bullet list of unique partner company names ("• ABC Ltd\n• XYZ Co"). */
  tradedWith: string;
  /** Bullet list of top products ("• Paracetamol\n• Amoxicillin"). */
  topProducts: string;
  website: string;
  email: string;
  phone: string;
  /** Primary physical address (when known). */
  address: string;
  /** Dynamic leadership/contact lines ("Name (Title)", one per line). */
  leadership: string;
  /** Concise provenance ("Source: url" or "Sources: a; b"). */
  sources: string;
  sNo: number;
}

export interface InternationalImporterDirectory {
  title: string;
  countrySections: Array<{ country: string; importers: InternationalImporterRow[] }>;
  totalImporters: number;
  excluded: { country: string; count: number };
  topProductsLimit: number;
}

export interface InternationalImporterColumns {
  key: string;
  header: string;
}

export const INTERNATIONAL_IMPORTER_COLUMNS: InternationalImporterColumns[] = [
  { key: 'country', header: 'Country' },
  { key: 'importer', header: 'Importer' },
  { key: 'tradedWith', header: 'Traded With' },
  { key: 'topProducts', header: 'Top Products' },
  { key: 'website', header: 'Website' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'address', header: 'Address' },
  { key: 'leadership', header: 'Leadership' },
  { key: 'sources', header: 'Sources' },
];

/** True when the company should be considered an importer (not exporter-only). */
export function isImporterContact(contact: ReportCompanyContact): boolean {
  const t = String(contact?.type || '').trim().toLowerCase();
  if (!t) return true;
  return t !== 'exporter' && t !== 'export';
}

function clean(text: string | null | undefined): string {
  if (!text) return '';
  let s = String(text).trim();
  s = s.replace(/\[([^\]]+)\]\((?:mailto:)?(?:https?:\/\/[^\)]+|[^\)]+)\)/gi, '$1');
  s = s.replace(/[\*_`~]/g, '');
  return s.trim();
}

/** Cleans whitespace/control characters only — never rewrites legal names. */
export function cleanCompanyNameForDisplay(name: string | null | undefined): string {
  if (!name) return '';
  return String(name)
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Safe display normalization for all-caps names ("ABC PHARMA LTD" → "Abc Pharma
 * Ltd"). Only uppercased runs are title-cased; dotted acronyms ("E.S.B"),
 * digit-bearing tokens ("250MG", "500GM"), tokens with any lowercase letter
 * (already mixed case), single letters, and common legal-form acronyms ("LLC",
 * "PTE", "GMBH", ...) are preserved. Never rewrites a name beyond casing — no
 * content is added or removed.
 */
const KEEP_UPPERCASE = new Set(['AB', 'LLC', 'LLP', 'PLC', 'PTE', 'LDA', 'GMBH', 'AG', 'SA', 'BV', 'CV', 'NV', 'SRL', 'EURL', 'SPRL', 'OOO', 'OCOO', 'AO']);

export function titleCaseName(name: string | null | undefined): string {
  const cleaned = cleanCompanyNameForDisplay(name);
  if (!cleaned) return '';
  return cleaned.replace(/(?<![A-Z0-9'])[A-Z][A-Z0-9']*/g, (m) => {
    if (m.length === 1) return m;
    if (KEEP_UPPERCASE.has(m)) return m;
    return m.charAt(0) + m.slice(1).toLowerCase();
  });
}

/** Placeholder values that carry no real information (never shown as facts). */
function isPlaceholder(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return true;
  return ['n/a', 'na', 'unknown', 'none', 'null', '-', 'nil', 'not found', 'not specified'].includes(t);
}

/**
 * Reduces a raw item description to a clean product name for ranking.
 * Deterministic and still derived from the real record: parenthetical invoice
 * annotations ("CREAM (OTHER DETAIL AS PER INVOICE #...)") are stripped so the
 * same product in different records merges into one ranked entry, and pure
 * boilerplate lines are dropped entirely.
 */
/** Regex for trailing annotation segments that carry no product info. */
const PRODUCT_ANNOTATION_CUT = /\b(?:drap\b|dr\s*ap|noc\b|batch\b|mfg\b|exp\b|expir\w*|manufactur\w*|date\s+of\s+issue|reg\s*(?:istration)?\s*(?:no\.?|number)?|sro\b|qty\b|under\s+claim|foc\b|invoice|packing\s*(?:list)?|unit\s+price|d\/g\s+health|other\s+details?|detail\s+as\s+per|on\s+average|carton|crts?\b|ctns?\b|crtns?\b|weight\b|as\s+per\s+inv\w*|e\.?t\.?c)/i;

/** Regex for leading generic/container prefixes ("PHARMACEUTICAL ITEMS: X"). */
const PRODUCT_PREFIX = /^(?:assorted\s+)?(?:(?:pharmaceuticals?|medicines?|medicaments?|medication|drugs?|medical|health\s*care|herbal|homeopathic)\s*(?:products?|items?|goods|finished\s*products?|supplies|medicines?)?)\s*[.:/_-]+\s*/i;

/** Generic container words that add no product value. */
const GENERIC_PRODUCT = /^(?:assorted\s+)?(?:pharmaceuticals?(?:\s+(?:products?|items?|goods|finished\s*products?|medicines?))?|medicines?|medicaments?|medication|medical\s+(?:supplies|items?|products?)|health\s*(?:care\s*)?products?|herbal\s*medicines?|drugs?|goods|et\b|etc\.?|e\.?t\.?c\.?)$/i;

/**
 * Reduces a raw item description to a clean product name for ranking.
 * Deterministic and still derived from the real record: parenthetical invoice
 * annotations are stripped, trailing annotation segments ("... DRAP NO. A-..."),
 * leading generic prefixes ("PHARMACEUTICAL ITEMS: X"), and generic container
 * words are removed so the same product in different records merges into one
 * ranked entry and only real product names remain.
 */
function cleanProductToken(raw: string): string {
  let t = String(raw || '').trim();
  if (!t) return '';
  const paren = t.indexOf('(');
  if (paren > 0) t = t.slice(0, paren).trim();
  t = t.replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!t || isPlaceholder(t)) return '';
  if (t.startsWith('(')) return '';

  t = t.split(PRODUCT_ANNOTATION_CUT)[0].trim();
  for (let i = 0; i < 3 && t; i++) {
    const stripped = t.replace(PRODUCT_PREFIX, '').trim();
    if (stripped === t) break;
    t = stripped;
  }
  if (!t || isPlaceholder(t)) return '';
  if (GENERIC_PRODUCT.test(t)) return '';
  if (!/[a-z]{2}/i.test(t)) return '';
  return t;
}

/**
 * Deterministic frequency ranking of the products actually present in the
 * importer's trade records. Count desc, alphabetical tie-break, capped at
 * `limit` (clamped to [1, MAX_TOP_PRODUCTS_LIMIT]).
 */
export function computeTopProducts(
  relationships: Array<{ itemDescription?: string }>,
  limit: number = DEFAULT_TOP_PRODUCTS_LIMIT
): string {
  const cap = Math.max(1, Math.min(MAX_TOP_PRODUCTS_LIMIT, Math.floor(limit) || DEFAULT_TOP_PRODUCTS_LIMIT));
  const tally = new Map<string, { count: number; display: string }>();
  const count = (desc: string | undefined) => {
    if (!desc) return;
    for (const item of String(desc).split(',').map((i) => i.trim()).filter(Boolean)) {
      const token = cleanProductToken(item);
      if (!token) continue;
      const key = token.toLowerCase();
      const cur = tally.get(key);
      if (cur) {
        cur.count++;
      } else {
        tally.set(key, { count: 1, display: token });
      }
    }
  };
  (relationships || []).forEach((r) => count(r.itemDescription));

  const entries = Array.from(tally.entries());
  entries.sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[0].localeCompare(b[0]);
  });

  return entries.slice(0, cap).map(([, v]) => `• ${titleCaseName(clean(v.display))}`).join('\n');
}

/**
 * Unique partner company names from the actual trade records. Deduplicated
 * case-insensitively (placeholder values dropped), ordered by shipment count
 * (desc) then alphabetically, and capped at MAX_TRADED_WITH companies with a
 * "+N more" remainder so a noisy partner list stays concise. Never invents
 * companies, never dumps the full shipment history.
 */
export function computeTradedWith(
  relationships: Array<{ partnerName: string; shipmentCount: number }>
): { tradedWith: string; tradedWithCount: number } {
  const byName = new Map<string, { name: string; count: number }>();
  for (const r of relationships || []) {
    const raw = cleanCompanyNameForDisplay(clean(r.partnerName));
    if (!raw || isPlaceholder(raw)) continue;
    const key = raw.toLowerCase();
    const cur = byName.get(key);
    if (cur) {
      cur.count += r.shipmentCount || 0;
    } else {
      byName.set(key, { name: raw, count: r.shipmentCount || 0 });
    }
  }
  const partners = Array.from(byName.values());
  partners.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  const shown = partners.slice(0, MAX_TRADED_WITH);
  const lines = shown.map((p) => `• ${titleCaseName(p.name)}`);
  if (partners.length > MAX_TRADED_WITH) {
    lines.push(`+${partners.length - MAX_TRADED_WITH} more`);
  }
  return {
    tradedWith: lines.join('\n'),
    tradedWithCount: partners.length,
  };
}

/** Dynamic leadership lines — only people actually known, capped for compactness. */
function leadershipLines(contact: ReportCompanyContact, maxPeople: number = 20): string {
  const people = normalizePeople(contact);
  if (people.length === 0) return '';
  const preferred = people.slice().sort((a, b) => {
    const aKey = a.designation && a.designation !== 'Key Contact' ? 0 : 1;
    const bKey = b.designation && b.designation !== 'Key Contact' ? 0 : 1;
    return aKey - bKey;
  });
  const shown = preferred.slice(0, maxPeople);
  const lines = shown.map((p) => {
    const title = clean(p.designation);
    return title
      ? `${titleCaseName(clean(p.name))} (${titleCaseName(title)})`
      : titleCaseName(clean(p.name));
  });
  if (preferred.length > maxPeople) {
    lines.push(`+${preferred.length - maxPeople} more`);
  }
  return lines.join('\n');
}

function contactFields(contact: ReportCompanyContact): Pick<InternationalImporterRow, 'website' | 'email' | 'phone' | 'address'> {
  const ci = normalizeContactInfo(contact);
  const website = ci.website ? clean(ci.website) : '';
  const email = ci.emails[0] || (contact.email ? clean(contact.email) : '');
  const phone = ci.phones[0] || (contact.phone ? clean(contact.phone) : '');
  const address = ci.addresses[0]?.address ? clean(ci.addresses[0].address) : '';
  return { website, email, phone, address };
}

function sourcesField(contact: ReportCompanyContact): string {
  const urls = Array.from(new Set((contact.sources || []).map((s) => clean(s?.url)).filter(Boolean)));
  if (urls.length === 0) return '';
  return urls.length === 1 ? `Source: ${urls[0]}` : `Sources: ${urls.join('; ')}`;
}

/**
 * Builds the canonical international importer directory from enriched contacts.
 * Optionally accepts a pre-built trade index (built once for batch exports).
 * `topProductsLimit` defaults to 5 and is clamped to [1, 10].
 */
export async function getInternationalImporterDirectory(
  contacts: ReportCompanyContact[],
  tradeIndex?: TradeIndex,
  opts: { topProductsLimit?: number } = {}
): Promise<InternationalImporterDirectory> {
  const topProductsLimit = Math.max(
    1,
    Math.min(MAX_TOP_PRODUCTS_LIMIT, Math.floor(opts.topProductsLimit ?? DEFAULT_TOP_PRODUCTS_LIMIT))
  );

  let index = tradeIndex;
  if (!index) {
    try {
      index = await TradeRelationshipResolver.buildTradeIndex();
    } catch (e) {
      console.warn('Failed building trade index:', e);
    }
  }

  const merged = mergeContacts(contacts || []);
  const importers = merged.filter(isImporterContact);

  const byCountry = new Map<string, InternationalImporterRow[]>();
  let excludedCount = 0;

  for (const c of importers) {
    const rawCountry = (c.country || '').trim();
    const country = normalizeCountryName(rawCountry) || 'Not Specified';
    if (isPakistanCountry(rawCountry)) {
      excludedCount++;
      continue;
    }

    const rels = index
      ? TradeRelationshipResolver.resolveFromIndex(c.company_name, index, 'importer', country).importedFrom
      : [];
    const tw = computeTradedWith(rels);
    const contact = contactFields(c);

    const row: InternationalImporterRow = {
      country,
      importer: titleCaseName(clean(c.company_name)),
      tradedWith: tw.tradedWith,
      topProducts: computeTopProducts(rels, topProductsLimit),
      website: contact.website,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      leadership: leadershipLines(c),
      sources: sourcesField(c),
      sNo: 0,
    };

    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country)!.push(row);
  }

  const countrySections = Array.from(byCountry.keys())
    .sort((a, b) => {
      const aNot = a === 'Not Specified';
      const bNot = b === 'Not Specified';
      if (aNot && bNot) return 0;
      if (aNot) return 1;
      if (bNot) return -1;
      return a.localeCompare(b);
    })
    .map((country) => ({
      country,
      importers: byCountry.get(country)!
        .sort((a, b) => a.importer.localeCompare(b.importer, undefined, { sensitivity: 'base' }))
        .map((row, i) => ({ ...row, sNo: i + 1 })),
    }));

  const totalImporters = countrySections.reduce((sum, s) => sum + s.importers.length, 0);

  return {
    title: INTERNATIONAL_IMPORTER_DIRECTORY_TITLE,
    countrySections,
    totalImporters,
    excluded: { country: 'Pakistan', count: excludedCount },
    topProductsLimit,
  };
}

/**
 * Flattens the directory into the CSV/XLSX grid. Multi-line bullet lists are
 * joined with `lineSep` (default "; ") so flat formats never contain raw
 * newlines inside a cell.
 */
export function flattenInternationalImporterRows(
  directory: InternationalImporterDirectory,
  columns: InternationalImporterColumns[] = INTERNATIONAL_IMPORTER_COLUMNS,
  opts: { lineSep?: string } = {}
): Record<string, any>[] {
  const lineSep = opts.lineSep ?? '; ';
  const rows: Record<string, any>[] = [];
  for (const section of directory.countrySections) {
    for (const imp of section.importers) {
      const rec: Record<string, any> = {};
      for (const col of columns) {
        let v = (imp as any)[col.key] ?? '';
        if (typeof v === 'string') {
          v = v.replace(/\n+/g, lineSep).trim();
        }
        rec[col.key] = v;
      }
      rows.push(rec);
    }
  }
  return rows;
}
