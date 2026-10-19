import { TradeRelationshipResolver } from './trade_relationship_resolver';
import type { ResolvedTradeRelationship } from './trade_relationship_resolver';
import type { ReportCompanyContact } from './docx_report';
import { canonicalEntityIdentityKey } from './company_identity';
import { normalizeCountryName } from '../src/utils/countryNormalizer';

export type TradeIndex = {
  importedFrom: Map<string, Map<string, ResolvedTradeRelationship>>;
  suppliedTo: Map<string, Map<string, ResolvedTradeRelationship>>;
};

export interface ReportPerson {
  name: string;
  designation: string;
  department?: string;
  emails: string[];
  phones: string[];
  sources: string[];
}

export interface NormalizedContactInfo {
  addresses: Array<{ address: string; type?: string; source_url?: string }>;
  emails: string[];
  phones: string[];
  fax_numbers: string[];
  whatsapp?: string;
  website?: string;
  linkedin?: string;
  linkedin_urls: string[];
  socials: Array<{ platform: string; url: string; verified?: boolean }>;
  sources: Array<{ url: string; title?: string; source_type?: string }>;
}

export interface NormalizedImporterReport {
  country: string;
  sNo: number;
  companyName: string;
  cleanName: string;
  role: string;
  tradeHistory: ResolvedTradeRelationship[];
  leadership: ReportPerson[];
  contactInfo: NormalizedContactInfo;
  totalShipments: number;
  totalValue: number;
}

export interface ContactReport {
  reportType: 'importer' | 'exporter';
  title: string;
  countrySections: Array<{ country: string; importers: NormalizedImporterReport[] }>;
  totalImporters: number;
}

export function getReportTitle(reportType: 'importer' | 'exporter'): string {
  return reportType === 'importer'
    ? 'EDGEVIEW — LIST OF IMPORTERS'
    : 'EDGEVIEW — LIST OF EXPORTERS';
}

export function getReportColumnLabels(reportType: 'importer' | 'exporter') {
  return {
    entityLabel: reportType === 'importer' ? 'Importer' : 'Exporter',
    nameHeader: reportType === 'importer' ? 'Importer Name' : 'Exporter Name',
    historyHeader: reportType === 'importer'
      ? 'Previous Exporters / Import History'
      : 'Supplied To / Export History',
  };
}

/**
 * Normalizes a single person record, deduplicating by name. Returns true when the
 * person is new, false when merged into an existing entry.
 */
function canonicalReportPersonName(name: string): string {
  return String(name || '')
    .normalize('NFKC')
    .trim()
    .replace(/^(?:mr|mrs|ms|miss|dr|prof|professor)\.?\s+/i, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeReportDesignation(designation: string): string {
  const parts = String(designation || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(' / ');
}

function addPerson(
  people: ReportPerson[],
  seen: Map<string, ReportPerson>,
  name: string,
  designation: string,
  department: string | undefined,
  emails: string[],
  phones: string[],
  sources: string[]
) {
  const clean = (name || '').trim();
  if (!clean) return;
  const key = canonicalReportPersonName(clean);
  if (!key) return;
  const existing = seen.get(key);
  if (existing) {
    const desig = normalizeReportDesignation(designation);
    if (
      desig &&
      (!existing.designation ||
        existing.designation === 'Key Contact' ||
        existing.designation === 'Decision Maker')
    ) {
      existing.designation = desig;
    }
    if (department && !existing.department) {
      existing.department = department;
    }
    (emails || []).forEach((e) => {
      const v = String(e || '').trim();
      if (v && !existing.emails.includes(v)) existing.emails.push(v);
    });
    (phones || []).forEach((ph) => {
      const v = String(ph || '').trim();
      if (v && !existing.phones.includes(v)) existing.phones.push(v);
    });
    (sources || []).forEach((s) => {
      const v = String(s || '').trim();
      if (v && !existing.sources.includes(v)) existing.sources.push(v);
    });
    return;
  }
  const person: ReportPerson = {
    name: clean,
    designation: normalizeReportDesignation(designation) || 'Key Contact',
    department,
    emails: (emails || []).map((e) => String(e || '').trim()).filter(Boolean),
    phones: (phones || []).map((p) => String(p || '').trim()).filter(Boolean),
    sources: (sources || []).map((s) => String(s || '').trim()).filter(Boolean),
  };
  people.push(person);
  seen.set(key, person);
}

export function normalizePeople(contact: ReportCompanyContact): ReportPerson[] {
  const people: ReportPerson[] = [];
  const seen = new Map<string, ReportPerson>();

  if (contact.ceo && String(contact.ceo).trim()) {
    addPerson(people, seen, contact.ceo, 'CEO', undefined, [], [], []);
  }

  if (Array.isArray(contact.contact_persons)) {
    contact.contact_persons.forEach((cp: any) => {
      if (cp && cp.name) {
        addPerson(
          people,
          seen,
          cp.name,
          cp.designation,
          cp.department,
          cp.email ? [cp.email] : [],
          cp.phone ? [cp.phone] : [],
          cp.source_url ? [cp.source_url] : []
        );
      }
    });
  }

  if (Array.isArray(contact.decision_makers)) {
    contact.decision_makers.forEach((dm: any) => {
      if (dm && dm.name) {
        const emails = Array.isArray(dm.emails) ? dm.emails.map((e: any) => e?.value) : [];
        const phones = Array.isArray(dm.phones) ? dm.phones.map((p: any) => p?.value) : [];
        addPerson(people, seen, dm.name, dm.designation, dm.department, emails, phones, []);
      }
    });
  }

  return people;
}

export function normalizeContactInfo(contact: ReportCompanyContact): NormalizedContactInfo {
  const peopleEmails = new Set<string>();
  const peoplePhones = new Set<string>();
  normalizePeople(contact).forEach((p) => {
    p.emails.forEach((e) => peopleEmails.add(e.toLowerCase()));
    p.phones.forEach((ph) => peoplePhones.add(ph));
  });

  const emails: string[] = [];
  const seenEmails = new Set<string>();
  const pushEmail = (e: any) => {
    const v = String(e || '').trim().toLowerCase();
    if (v && !seenEmails.has(v) && !peopleEmails.has(v)) {
      seenEmails.add(v);
      emails.push(v);
    }
  };
  if (contact.email) pushEmail(contact.email);
  if (Array.isArray(contact.emails_list)) contact.emails_list.forEach((e) => pushEmail(e));

  const phones: string[] = [];
  const seenPhones = new Set<string>();
  const pushPhone = (ph: any) => {
    const v = String(ph || '').trim();
    if (v && !seenPhones.has(v) && !peoplePhones.has(v)) {
      seenPhones.add(v);
      phones.push(v);
    }
  };
  if (contact.phone) pushPhone(contact.phone);
  if (Array.isArray(contact.phones_list)) contact.phones_list.forEach((ph) => pushPhone(ph));

  let addresses = Array.isArray(contact.addresses)
    ? contact.addresses
        .map((a: any) => ({
          address: String(a?.address || '').trim(),
          type: a?.type,
          source_url: a?.source_url,
        }))
        .filter((a) => a.address)
    : [];
  if (addresses.length === 0 && contact.address && String(contact.address).trim()) {
    addresses = [{ address: String(contact.address).trim(), type: undefined, source_url: undefined }];
  }

  return {
    addresses,
    emails,
    phones,
    fax_numbers: Array.isArray(contact.fax_numbers)
      ? contact.fax_numbers.map((f) => String(f || '').trim()).filter(Boolean)
      : [],
    whatsapp: contact.whatsapp ? String(contact.whatsapp).trim() : (contact.whatsapp_details?.value ? String(contact.whatsapp_details.value).trim() : undefined),
    website: contact.website ? String(contact.website).trim() : undefined,
    linkedin: contact.linkedin ? String(contact.linkedin).trim() : undefined,
    linkedin_urls: Array.from(new Set([contact.linkedin, ...(contact.linkedin_urls || [])].map((value) => String(value || '').trim()).filter(Boolean))),
    socials: Array.isArray(contact.socials) ? contact.socials : [],
    sources: Array.isArray(contact.sources) ? contact.sources : [],
  };
}

/**
 * Merges duplicate company records by normalized company name so that a single
 * importer/exporter is never rendered twice with split intelligence.
 */
export function mergeContacts(contacts: ReportCompanyContact[]): ReportCompanyContact[] {
  const merged = new Map<string, ReportCompanyContact>();
  for (const c of contacts) {
    if (!c || !c.company_name) continue;
    const normalizedCountry = normalizeCountryName(c.country || '');
    const key = canonicalEntityIdentityKey(
      TradeRelationshipResolver.cleanCompanyName(c.company_name) || c.company_name,
      normalizedCountry
    );
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...c });
      continue;
    }
    if (!existing.country && c.country) existing.country = c.country;
    if (!existing.ceo && c.ceo) existing.ceo = c.ceo;
    if (!existing.email && c.email) existing.email = c.email;
    if (!existing.phone && c.phone) existing.phone = c.phone;
    if (!existing.whatsapp && c.whatsapp) existing.whatsapp = c.whatsapp;
    if (!existing.linkedin && c.linkedin) existing.linkedin = c.linkedin;
    if (!existing.website && c.website) existing.website = c.website;
    if (!existing.address && c.address) existing.address = c.address;
    existing.emails_list = [...(existing.emails_list || []), ...(c.emails_list || [])];
    existing.phones_list = [...(existing.phones_list || []), ...(c.phones_list || [])];
    existing.addresses = [...(existing.addresses || []), ...(c.addresses || [])];
    existing.contact_persons = [...(existing.contact_persons || []), ...(c.contact_persons || [])];
    existing.decision_makers = [...(existing.decision_makers || []), ...(c.decision_makers || [])];
    existing.socials = [...(existing.socials || []), ...(c.socials || [])];
    existing.sources = [...(existing.sources || []), ...(c.sources || [])];
    merged.set(key, existing);
  }
  return Array.from(merged.values());
}

function sortCountries(countries: string[]): string[] {
  return countries.slice().sort((a, b) => {
    const aNot = a === 'Not Specified';
    const bNot = b === 'Not Specified';
    if (aNot && bNot) return 0;
    if (aNot) return 1;
    if (bNot) return -1;
    return a.localeCompare(b);
  });
}

/**
 * Builds the single normalized directory report consumed by both the PDF and DOCX
 * renderers. Trade history is resolved from a pre-built O(1) index when provided,
 * otherwise the index is built once here.
 */
export async function buildContactReport(
  contacts: ReportCompanyContact[],
  reportType: 'importer' | 'exporter' = 'importer',
  tradeIndex?: TradeIndex
): Promise<ContactReport> {
  let index = tradeIndex;
  if (!index) {
    try {
      index = await TradeRelationshipResolver.buildTradeIndex();
    } catch (e) {
      console.warn('Failed building trade index:', e);
    }
  }

  const merged = mergeContacts(contacts).filter((contact) => {
    const role = String(contact.type || '').toLowerCase();
    if (!role || role === 'company' || role === 'both') return true;
    return reportType === 'importer' ? role === 'importer' : role === 'exporter';
  });
  const roleMode: 'importer' | 'exporter' = reportType === 'importer' ? 'importer' : 'exporter';
  const roleLabel = reportType === 'importer' ? 'Importer' : 'Exporter';

  const byCountry = new Map<string, NormalizedImporterReport[]>();
  for (const c of merged) {
    const country = (c.country || '').trim() || 'Not Specified';
    const cleanName = TradeRelationshipResolver.cleanCompanyName(c.company_name) || c.company_name.trim().toLowerCase();
    const rels = index
      ? TradeRelationshipResolver.resolveFromIndex(c.company_name, index, roleMode, country)
      : { importedFrom: [], suppliedTo: [] };
    const tradeHistory = (roleMode === 'importer' ? rels.importedFrom : rels.suppliedTo)
      .slice()
      .sort((a, b) => (b.shipmentCount || 0) - (a.shipmentCount || 0));

    const entry: NormalizedImporterReport = {
      country,
      sNo: 0,
      companyName: String(c.company_name).trim(),
      cleanName,
      role: roleLabel,
      tradeHistory,
      leadership: normalizePeople(c),
      contactInfo: normalizeContactInfo(c),
      totalShipments: tradeHistory.reduce((sum, r) => sum + (r.shipmentCount || 0), 0),
      totalValue: tradeHistory.reduce((sum, r) => sum + (r.totalVal || 0), 0),
    };

    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country)!.push(entry);
  }

  const countrySections = sortCountries(Array.from(byCountry.keys())).map((country) => {
    const importers = byCountry
      .get(country)!
      .sort((a, b) => a.companyName.localeCompare(b.companyName))
      .map((imp, i) => ({ ...imp, sNo: i + 1 }));
    return { country, importers };
  });

  return {
    reportType,
    title: getReportTitle(reportType),
    countrySections,
    totalImporters: merged.length,
  };
}
