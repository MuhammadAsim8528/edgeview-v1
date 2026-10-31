import React from 'react';
import { 
  ShieldCheck, 
  ExternalLink, 
  Globe, 
  FileText, 
  CheckCircle, 
  X, 
  Award, 
  Target, 
  Activity, 
  Clock, 
  AlertTriangle, 
  HelpCircle,
  TrendingUp,
  Heart,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  Linkedin
} from 'lucide-react';
import { CompanyContact, SourceEvidence } from '../types';
import { safeFetchJson } from '../utils/safeFetch';

interface CapturedResult {
  id: string;
  raw_record_id: string;
  provider: string;
  rank: number;
  title: string;
  url: string;
  snippet: string;
  status: string;
  error?: string;
  metadata?: Record<string, unknown>;
  text?: string;
  markdown?: string;
  html?: string;
  links?: string[];
}

interface CapturedRun {
  id: string;
  results: CapturedResult[];
  raw_records: Array<{ id: string; kind: string; provider: string; failure?: { message?: string }; latency_ms: number }>;
}

interface SourceEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: CompanyContact | null;
}

export const SourceEvidenceModal: React.FC<SourceEvidenceModalProps> = ({
  isOpen,
  onClose,
  contact,
}) => {
  const [activeTab, setActiveTab] = React.useState<'profile' | 'evidence' | 'captured'>('profile');
  const [capturedRun, setCapturedRun] = React.useState<CapturedRun | null>(null);
  const [capturedLoading, setCapturedLoading] = React.useState(false);
  const [expandedResult, setExpandedResult] = React.useState('');

  React.useEffect(() => {
    setActiveTab('profile');
    setCapturedRun(null);
    setExpandedResult('');
  }, [contact?.id]);

  React.useEffect(() => {
    if (!isOpen || activeTab !== 'captured' || !contact?.edgeview_v1_run_id || capturedRun?.id === contact.edgeview_v1_run_id) return;
    setCapturedLoading(true);
    void safeFetchJson<{ run: CapturedRun }>(`/api/v1/runs/${encodeURIComponent(contact.edgeview_v1_run_id)}`)
      .then(({ ok, data }) => setCapturedRun(ok && data?.run ? data.run : null))
      .finally(() => setCapturedLoading(false));
  }, [activeTab, capturedRun?.id, contact?.edgeview_v1_run_id, isOpen]);

  if (!isOpen || !contact) return null;

  const evidenceList: SourceEvidence[] = contact.evidence || [];
  const sourcesList = contact.sources || [];
  const traceList: any[] = (contact as any).research_trace || [];
  const researchAssessment = contact.research_assessment;
  const contradictions = contact.contradictions || [];

  const uniqueStrings = (values: Array<string | undefined | null>): string[] => {
    const seen = new Set<string>();
    return values.map((value) => String(value || '').trim()).filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const emails = uniqueStrings([
    contact.email,
    ...(contact.emails_list || []),
    ...(contact.company_contacts || []).map((item) => item.email),
  ]);
  const phones = uniqueStrings([
    contact.phone,
    ...(contact.phones_list || []),
    ...(contact.company_contacts || []).map((item) => item.phone),
  ]);
  const addresses = uniqueStrings([
    contact.address,
    ...(contact.addresses || []).map((item) => item.address),
  ]);
  const professionalLinks = uniqueStrings([
    contact.linkedin,
    ...(contact.linkedin_urls || []),
    ...(contact.socials || []).map((item) => item.url),
  ]);
  const personKey = (name: string): string => String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^(?:(?:mr|mrs|ms|miss|dr|prof|professor|sir|madam)\.?\s+)+/i, '')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanRepeatedDesignation = (designation?: string): string => {
    const value = String(designation || '').trim();
    const repeated = value.match(/^(.+)\s+\/\s+\1$/i);
    return repeated ? repeated[1].trim() : value;
  };
  const peopleByName = new Map<string, any>();
  for (const person of contact.contact_persons || []) {
    if (person?.name) peopleByName.set(personKey(person.name), {
      ...person,
      designation: cleanRepeatedDesignation(person.designation),
    });
  }
  for (const person of contact.decision_makers || []) {
    if (!person?.name) continue;
    const key = personKey(person.name);
    if (!peopleByName.has(key)) {
      peopleByName.set(key, {
        ...person,
        designation: cleanRepeatedDesignation(person.designation),
        email: person.emails?.[0]?.value || '',
        phone: person.phones?.[0]?.value || '',
        linkedin_url: person.socials?.find((item) => /linkedin\.com/i.test(item.url))?.url || '',
        source_url: person.sources?.[0]?.url || '',
      });
    }
  }
  const people = Array.from(peopleByName.values());

  return (
    <div id="source_evidence_modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-hidden">
      <div 
        className="bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-3xl border border-[#333333] flex flex-col overflow-hidden my-auto"
        style={{ maxHeight: 'min(92vh, calc(100dvh - 1.5rem))' }}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 flex items-center justify-center border border-[#10b981]/40">
              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>EdgeView Company Intelligence</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-mono">
                  {contact.company_name}
                </span>
              </h3>
              <p className="text-[11px] text-[#9ca3af]">Company details, supporting sources, and every retained provider result</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-white p-1 rounded-md hover:bg-[#333333] transition-colors cursor-pointer"
            aria-label="Close research hub"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#333333] bg-[#1d1d1d] px-4 shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#10b981] text-white bg-[#262626]/40'
                : 'border-transparent text-[#9ca3af] hover:text-white hover:bg-[#262626]/20'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Company Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'evidence' 
                ? 'border-[#10b981] text-white bg-[#262626]/40' 
                : 'border-transparent text-[#9ca3af] hover:text-white hover:bg-[#262626]/20'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Evidence Corpus</span>
          </button>

          <button
            onClick={() => setActiveTab('captured')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
              activeTab === 'captured'
                ? 'border-amber-400 text-white bg-[#262626]/40'
                : 'border-transparent text-[#9ca3af] hover:text-white hover:bg-[#262626]/20'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All Captured Results</span>
          </button>

        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 sm:space-y-5 custom-scrollbar">

          {/* TAB 1: CANONICAL COMPANY INTELLIGENCE */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-fadeIn">
              <section className="rounded-lg border border-[#333333] bg-[#262626] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white">{contact.company_name}</h4>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      {contact.type && <span className="rounded border border-sky-800 bg-sky-950 px-2 py-0.5 text-sky-300">{contact.type}</span>}
                      {contact.country && <span className="rounded border border-purple-800 bg-purple-950 px-2 py-0.5 text-purple-300">{contact.country}</span>}
                      {contact.industry && <span className="rounded border border-[#444] bg-[#1a1a1a] px-2 py-0.5 text-gray-300">{contact.industry}</span>}
                    </div>
                  </div>
                  {contact.website && (
                    <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">
                      <Globe className="h-3.5 w-3.5" /> Official website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </section>

              {contact.research_validation_status === 'needs_revalidation' && (
                <p role="status" className="rounded-lg border border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-200">
                  Previous research needs company-country revalidation. Its cached contact fields are withheld; original captured results remain available. Run research again to apply the current rules.
                </p>
              )}
              {!!contact.unscoped_facts?.length && (
                <details className="rounded-lg border border-amber-800 bg-amber-950/20 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-amber-200">
                    Country scope not established ({contact.unscoped_facts.length})
                  </summary>
                  <p className="mt-2 text-xs text-gray-300">These captured facts have not been attributed to this country. They are kept for inspection and are not listed as local contacts.</p>
                  <ul className="mt-3 space-y-2 text-xs text-gray-300">
                    {contact.unscoped_facts.slice(0, 50).map((fact, index) => (
                      <li key={`${fact.source_result_id}-${fact.field}-${index}`} className="break-words">
                        <strong>{fact.field}: </strong>{fact.value}
                        <div className="text-gray-400">Source: {fact.source_url || fact.source_result_id}</div>
                      </li>
                    ))}
                  </ul>
                  {contact.unscoped_facts.length > 50 && <p className="mt-2 text-xs text-gray-400">Showing the first 50 retained facts. Full original evidence remains in captured results.</p>}
                </details>
              )}
              {researchAssessment && (
                <section className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Trusted intelligence assessment">
                  {[
                    ['Coverage', researchAssessment.coverage],
                    ['Evidence strength', researchAssessment.evidence_strength],
                    ['Provenance', researchAssessment.provenance],
                    ['Unresolved contradictions', String(researchAssessment.unresolved_contradictions)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#333] bg-[#222] p-3">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
                      <div className="mt-1 text-xs font-bold text-emerald-300">{value}</div>
                    </div>
                  ))}
                  <p className="col-span-2 text-[10px] text-gray-500 md:col-span-4">{researchAssessment.basis}</p>
                </section>
              )}

              {contradictions.length > 0 && (
                <section className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Contradictory evidence</h4>
                  <div className="mt-2 space-y-1">
                    {contradictions.map((item) => <div key={item.id} className="text-xs text-amber-100">{item.predicate.replace(/[_:]/g, ' ')} — {item.status} ({item.claim_ids.length} supported claims)</div>)}
                  </div>
                </section>
              )}

              {emails.length === 0 && phones.length === 0 && addresses.length === 0 && people.length === 0 && !contact.website && (
                <section className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">No verified public contact found</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    EdgeView completed its bounded identity-anchored searches but did not find company-owned contact data strong enough to display. This does not prove that no contact exists; it prevents directory staff, unrelated companies, dates, and registration numbers from being shown as this company's contacts.
                  </p>
                  {contact.edgeview_v1_run_id && <p className="mt-2 break-all font-mono text-[10px] text-slate-500">Retrieval run: {contact.edgeview_v1_run_id}</p>}
                </section>
              )}

              {(emails.length > 0 || phones.length > 0 || (contact.fax_numbers || []).length > 0 || addresses.length > 0) && (
                <section>
                  <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-400">Contact</h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {emails.length > 0 && (
                      <div className="rounded-lg border border-[#333] bg-[#222] p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-400"><Mail className="h-3.5 w-3.5" /> Emails</div>
                        <div className="space-y-1">{emails.map((email) => <a key={email} href={`mailto:${email}`} className="block break-all text-xs text-white hover:underline">{email}</a>)}</div>
                      </div>
                    )}
                    {phones.length > 0 && (
                      <div className="rounded-lg border border-[#333] bg-[#222] p-3">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-sky-400"><Phone className="h-3.5 w-3.5" /> Phones</div>
                        <div className="space-y-1">{phones.map((phone) => <div key={phone} className="text-xs text-white">{phone}</div>)}</div>
                      </div>
                    )}
                    {(contact.fax_numbers || []).length > 0 && (
                      <div className="rounded-lg border border-[#333] bg-[#222] p-3">
                        <div className="mb-2 text-xs font-bold text-amber-400">Fax</div>
                        <div className="space-y-1">{uniqueStrings(contact.fax_numbers || []).map((fax) => <div key={fax} className="text-xs text-white">{fax}</div>)}</div>
                      </div>
                    )}
                    {addresses.length > 0 && (
                      <div className="rounded-lg border border-[#333] bg-[#222] p-3 md:col-span-2">
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-purple-400"><MapPin className="h-3.5 w-3.5" /> Addresses</div>
                        <div className="space-y-2">{addresses.map((address) => <div key={address} className="text-xs leading-relaxed text-white">{address}</div>)}</div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {people.length > 0 && (
                <section>
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400"><Users className="h-3.5 w-3.5" /> Leadership / Key People ({people.length})</h4>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {people.map((person, index) => (
                      <div key={`${person.name}-${index}`} className="rounded-lg border border-[#333] bg-[#222] p-3">
                        <div className="font-semibold text-white">{person.name}</div>
                        {person.designation && <div className="text-[11px] text-gray-400">{person.designation}</div>}
                        {(person.department || person.branch || person.country) && <div className="mt-1 text-[10px] text-purple-300">{[person.department, person.branch, person.country].filter(Boolean).join(' • ')}</div>}
                        <div className="mt-2 space-y-1 text-[11px]">
                          {person.email && <a href={`mailto:${person.email}`} className="block break-all text-emerald-400 hover:underline">{person.email}</a>}
                          {person.phone && <div className="text-gray-300">{person.phone}</div>}
                          {person.linkedin_url && <a href={person.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline"><Linkedin className="h-3 w-3" /> LinkedIn</a>}
                          {person.source_url && <a href={person.source_url} target="_blank" rel="noreferrer" className="block truncate text-sky-400 hover:underline">Source: {person.source_url}</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {professionalLinks.length > 0 && (
                <section>
                  <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-400">Professional Presence</h4>
                  <div className="flex flex-wrap gap-2">{professionalLinks.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded border border-blue-800 bg-blue-950/40 px-2 py-1 text-xs text-blue-300 hover:underline"><Linkedin className="h-3 w-3 shrink-0" /><span className="truncate">{url}</span></a>)}</div>
                </section>
              )}

              {(contact.source_file || sourcesList.length > 0) && (
                <section className="rounded-lg border border-[#333] bg-[#222] p-3 text-xs text-gray-300">
                  <div className="font-bold text-gray-400">Trade / source context</div>
                  {contact.source_file && <div className="mt-1">Dataset: <span className="text-white">{contact.source_file}</span></div>}
                  <div className="mt-1">Role: <span className="text-white">{contact.type || 'Other'}</span>{contact.country ? <> • Target country: <span className="text-white">{contact.country}</span></> : null}</div>
                  {(contact.traded_with || []).length > 0 && <div className="mt-2">Traded with: <span className="text-white">{contact.traded_with!.join(' • ')}</span></div>}
                  {(contact.top_products || []).length > 0 && <div className="mt-2">Top products: <span className="text-white">{contact.top_products!.join(' • ')}</span></div>}
                  {sourcesList.length > 0 && <div className="mt-1 text-[#10b981]">{sourcesList.length} evidence source{sourcesList.length === 1 ? '' : 's'} available in the Evidence Corpus tab.</div>}
                </section>
              )}
            </div>
          )}
          
          {/* TAB 2: EVIDENCE CORPUS */}
          {activeTab === 'evidence' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Extracted Facts */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 mb-2.5 uppercase tracking-wider">
                  Extracted Facts & Verifications
                </h4>

                {evidenceList.length === 0 ? (
                  <div className="p-4 bg-[#262626] rounded-lg text-xs text-[#9ca3af] italic text-center border border-[#333333]">
                    No granular evidence entries available. Data was retrieved from cached directory profile.
                  </div>
                ) : (
                  <div className="bg-[#262626] rounded-lg border border-[#333333] overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#1f1f1f] text-[#9ca3af] border-b border-[#333333]">
                        <tr>
                          <th className="px-3 py-2">Field</th>
                          <th className="px-3 py-2">Extracted Value</th>
                          <th className="px-3 py-2">Source Origin</th>
                          <th className="px-3 py-2 text-center">Grounding</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#333333] text-white">
                        {evidenceList.map((ev, idx) => (
                          <tr key={idx} className="hover:bg-[#1f1f1f] transition-colors">
                            <td className="px-3 py-2 font-bold text-[#10b981] font-mono">{ev.field}</td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-white font-mono break-all">{ev.value}</div>
                              {ev.evidence_text && (
                                <div className="text-[10px] text-amber-200 italic bg-amber-950/20 p-2 rounded mt-1 border border-amber-800/30">
                                  "{ev.evidence_text}"
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sky-400">
                              {ev.source_url ? (
                                <a
                                  href={ev.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center space-x-1 hover:underline truncate max-w-[160px]"
                                >
                                  <Globe className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{ev.source_url.replace(/^https?:\/\//, '')}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-gray-500 italic">Direct API</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-emerald-400">
                              Source-grounded
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Web Sources Scraped */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 mb-2.5 uppercase tracking-wider">
                  Scraped Source URLs
                </h4>

                {sourcesList.length === 0 ? (
                  <div className="p-3 bg-[#262626] rounded-lg text-xs text-[#9ca3af] italic border border-[#333333]">
                    Primary website: {contact.website || 'N/A'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sourcesList.map((src, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#262626] border border-[#333333] rounded-lg flex items-center justify-between text-xs hover:border-[#444] transition-all"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-white font-medium block truncate">{src.title || src.url}</span>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-sky-400 hover:underline font-mono truncate block"
                            >
                              {src.url}
                            </a>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] bg-sky-950 text-sky-300 border border-sky-800 shrink-0 ml-2 uppercase font-mono">
                          {src.source_type || 'web'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'captured' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
                This is the lossless provider view. It includes every captured candidate, including weak, conflicting, directory, and failed results. These entries are evidence for review, not automatically asserted as the company's contact details.
              </div>
              {!contact.edgeview_v1_run_id ? (
                <div className="rounded-lg border border-[#333] bg-[#222] p-5 text-center text-xs text-gray-400">This company has not been researched yet.</div>
              ) : capturedLoading ? (
                <div className="rounded-lg border border-[#333] bg-[#222] p-5 text-center text-xs text-gray-400">Loading the complete retained run…</div>
              ) : !capturedRun ? (
                <div className="rounded-lg border border-red-900 bg-red-950/20 p-5 text-center text-xs text-red-300">The retained run could not be loaded.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-[#333] bg-[#222] p-3"><div className="text-[10px] uppercase text-gray-500">Provider results</div><div className="text-lg font-bold text-white">{capturedRun.results.length}</div></div>
                    <div className="rounded border border-[#333] bg-[#222] p-3"><div className="text-[10px] uppercase text-gray-500">Raw records / failures</div><div className="text-lg font-bold text-white">{capturedRun.raw_records.length} / {capturedRun.raw_records.filter(record => record.failure).length}</div></div>
                  </div>
                  {capturedRun.results.map((result) => {
                    const open = expandedResult === result.id;
                    return (
                      <article key={result.id} className="rounded-lg border border-[#333] bg-[#222] p-3">
                        <div className="text-[10px] uppercase text-amber-300">{result.provider} · rank {result.rank} · {result.status}</div>
                        <div className="mt-1 text-sm font-semibold text-white">{result.title || '(Untitled result)'}</div>
                        {result.url && <a href={result.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-[11px] text-sky-400 hover:underline">{result.url}</a>}
                        <p className="mt-2 text-xs leading-5 text-gray-300">{result.snippet || 'No snippet returned.'}</p>
                        {result.error && <div className="mt-2 rounded bg-red-950/40 p-2 text-[11px] text-red-300">{result.error}</div>}
                        <button onClick={() => setExpandedResult(open ? '' : result.id)} className="mt-2 text-[11px] font-semibold text-emerald-400 hover:underline">{open ? 'Hide complete captured payload' : 'Show complete captured payload'}</button>
                        {open && <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 text-[10px] text-gray-300">{JSON.stringify(result, null, 2)}</pre>}
                      </article>
                    );
                  })}
                  {capturedRun.raw_records.filter(record => record.failure).map((record) => (
                    <div key={record.id} className="rounded border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-200">
                      <strong>{record.provider} {record.kind} failure:</strong> {record.failure?.message || 'Structured provider failure retained'} ({record.latency_ms}ms)
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#333333] bg-[#262626] flex items-center justify-between text-xs text-[#9ca3af]">
          <span className="flex items-center space-x-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="text-[11px]">Sources and raw provider records are retained</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-xs font-semibold text-[#e5e7eb] hover:bg-[#333] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
