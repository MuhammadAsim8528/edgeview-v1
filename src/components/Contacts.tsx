import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  CheckSquare,
  Square,
  Mail,
  Phone,
  MessageSquare,
  Linkedin,
  Bot,
  Sparkles,
  Building2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Globe,
  MapPin,
  Zap,
  FileText,
  Activity,
  Award,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { CompanyContact } from '../types';
import { BatchEnrichmentModal } from './BatchEnrichmentModal';
import { ExportReportModal } from './ExportReportModal';
import { SourceEvidenceModal } from './SourceEvidenceModal';
import { SummaryCards } from './SummaryCards';
import { safeFetchJson } from '../utils/safeFetch';
import { normalizeCountryName } from '../utils/countryNormalizer';
import { GlobalExportPayload } from './GlobalExportModal';
import { contactExportReportType } from '../utils/exportRequest';
import { useEdgeViewRuntimeState } from '../hooks/useEdgeViewRuntimeState';
import { contactResearchCategory, matchesResearchFilter } from '../../shared/contact_research_scope';
import { directoryPage as getDirectoryPage } from '../utils/directoryPagination';

interface ContactsProps {
  contacts: CompanyContact[];
  onFetchDetailsAutomated?: (companyName: string, id?: string, forceFetch?: boolean) => Promise<any>;
  onOpenExport?: (payload: GlobalExportPayload) => void;
  refreshData?: () => void;
}

const decodeDisplayText = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* retain malformed source text */ }
  // Some historical captures concatenated an identical visible string twice.
  if (decoded.length % 2 === 0) {
    const half = decoded.length / 2;
    if (decoded.slice(0, half) === decoded.slice(half)) decoded = decoded.slice(0, half);
  }
  return decoded.trim();
};

export const Contacts: React.FC<ContactsProps> = ({
  contacts,
  onFetchDetailsAutomated,
  onOpenExport,
  refreshData,
}) => {
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('edgeview_contacts_search') || '');
  // Show every researched company by default, but preserve an explicitly saved
  // filter. Reapplying an ENRICHED migration on every mount erased user choice.
  const [filterType, setFilterType] = useState<string>(() => {
    const saved = localStorage.getItem('edgeview_contacts_filter');
    return saved || 'RESEARCHED';
  });
  const [fetchingDetailsId, setFetchingDetailsId] = useState<string | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [evidenceContact, setEvidenceContact] = useState<CompanyContact | null>(null);
  const { state: runtimeState } = useEdgeViewRuntimeState();
  const researchCapability = runtimeState.capabilities?.company_enrichment;
  const researchAvailable = Boolean(researchCapability?.available);
  const researchReason = researchCapability?.reason || 'Checking company research capability...';
  const researchRemediation = researchCapability?.remediation || '';

  // Batch selections are intentionally session-local. Persisting a large checked
  // set across reloads can leave a destructive/expensive bulk action silently armed.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'directory'>(() => localStorage.getItem('edgeview_contacts_view') === 'directory' ? 'directory' : 'table');
  const [directoryData, setDirectoryData] = useState<IntlDirectory | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState({ total_companies: 0, researched_companies: 0, contacts_found: 0, unresolved_after_research: 0, not_researched: 0, excluded_exporters: 0, research_scope: 0, source_records: 0 });
  const loadSummary = async () => {
    try {
      const { ok, data } = await safeFetchJson<any>('/api/summary');
      if (ok && data) {
        setSummaryData(data);
      }
    } catch (err) { console.error('Failed to load company research summary', err); }
  };

  useEffect(() => {
    loadSummary();
  }, [contacts]);

  const [currentPage, setCurrentPage] = useState<number>(() => Math.max(1, Number(localStorage.getItem('edgeview_contacts_page')) || 1));
  const [pageSize, setPageSize] = useState<number>(() => [25, 50, 100].includes(Number(localStorage.getItem('edgeview_contacts_page_size'))) ? Number(localStorage.getItem('edgeview_contacts_page_size')) : 25);
  const filtersMounted = useRef(false);

  useEffect(() => { localStorage.setItem('edgeview_contacts_search', searchTerm); }, [searchTerm]);
  useEffect(() => { localStorage.setItem('edgeview_contacts_filter', filterType); }, [filterType]);
  useEffect(() => { localStorage.removeItem('edgeview_contacts_selected'); }, []);
  useEffect(() => { localStorage.setItem('edgeview_contacts_view', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('edgeview_contacts_page', String(currentPage)); }, [currentPage]);
  useEffect(() => { localStorage.setItem('edgeview_contacts_page_size', String(pageSize)); }, [pageSize]);

  const filteredContacts = React.useMemo(() => {
    const contactRichness = (c: CompanyContact) => {
      const emails = c.emails_list?.length || (c.email ? 1 : 0);
      const phones = c.phones_list?.length || (c.phone ? 1 : 0);
      const leaders = c.contact_persons?.length || (c.ceo ? 1 : 0);
      const addresses = (c as any).addresses?.length || ((c as any).address ? 1 : 0);
      const website = (c as any).website ? 1 : 0;
      return emails * 4 + phones * 3 + leaders * 2 + addresses * 2 + website;
    };
    return contacts.filter((c) => {
      const searchableContacts = (c.contact_persons || []).map((person) => `${person.name} ${person.designation || ''}`).join(' ');
      const matchesSearch =
        c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.ceo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.website || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.emails_list || []).join(' ').toLowerCase().includes(searchTerm.toLowerCase()) ||
        searchableContacts.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch && matchesResearchFilter(c, filterType);
    }).sort((a, b) => {
      const qualityWeight = (value?: string) => value === 'COMPLETE' ? 3 : value === 'PARTIAL' ? 2 : value === 'NOT_FOUND' ? 0 : 1;
      return qualityWeight(b.quality_status) - qualityWeight(a.quality_status)
        || contactRichness(b) - contactRichness(a)
        || a.company_name.localeCompare(b.company_name);
    });
  }, [contacts, searchTerm, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const paginatedContacts = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    if (!filtersMounted.current) {
      filtersMounted.current = true;
      return;
    }
    setCurrentPage(1);
  }, [searchTerm, filterType, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContacts.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFetchDetails = async (companyName: string, id: string, forceFetch: boolean = false) => {
    if (!onFetchDetailsAutomated) return;
    if (!researchAvailable) {
      console.warn(`Company research unavailable: ${researchReason}`);
      return;
    }
    setFetchingDetailsId(id);
    try {
      await onFetchDetailsAutomated(companyName, id, forceFetch);
      await loadSummary();
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setFetchingDetailsId(null);
    }
  };

  const handleRetryFailed = () => {
    // Keep this action aligned with /api/summary's unresolved_after_research
    // contract: only previously researched records with no retained public
    // information qualify. Excluded Pakistan exporters and untouched records
    // must never be swept into a bulk retry merely because they lack email/phone.
    const failedIds = contacts
      .filter(c => contactResearchCategory(c) === 'UNRESOLVED')
      .map(c => c.id);

    if (failedIds.length === 0) {
      alert('No failed or un-enriched company records found to retry.');
      return;
    }

    setSelectedIds(failedIds);
    setIsBatchModalOpen(true);
  };

  const loadDirectory = async () => {
    if (directoryData) return;
    setDirectoryLoading(true);
    try {
      const { ok, data } = await safeFetchJson<IntlDirectory>('/api/international-importer-directory');
      if (ok && data) {
        setDirectoryData(data);
      }
    } catch (err) {
      console.error('Failed to load international importer directory:', err);
    } finally {
      setDirectoryLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'directory') void loadDirectory();
  }, []);

  const handleViewModeToggle = (mode: 'table' | 'directory') => {
    setViewMode(mode);
    if (mode === 'directory') loadDirectory();
  };

  return (
    <div className="space-y-4">
      <SummaryCards data={summaryData} onFilterClick={(f) => setFilterType(f)} />

      {/* Main Directory Table Container */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] shadow-xs overflow-hidden">
        {/* Header Toolbar Banner */}
        <div className="p-4 bg-[#262626] text-white flex flex-wrap items-center justify-between gap-4 border-b border-[#333333]">
          <div>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#10b981]" />
              <h2 className="text-base font-bold text-white">
                {viewMode === 'directory'
                  ? 'Importer Directory'
                  : 'Company Research'}
                <span className="text-[#10b981] font-mono text-sm">
                  ({viewMode === 'directory' ? (directoryData?.totalImporters ?? '…') : contacts.length})
                </span>
              </h2>
            </div>
            <p className="text-xs text-[#9ca3af] mt-1">
              Every researched importer is visible. Open Intelligence to inspect promoted fields and all captured provider candidates.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsBatchModalOpen(true)}
              disabled={!researchAvailable}
              title={researchAvailable ? 'Research selected or eligible companies' : `${researchReason}${researchRemediation ? ` ${researchRemediation}` : ''}`}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#10b981]/80 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#10b981]"
            >
              <Bot className="w-3.5 h-3.5 text-white" />
              <span>Research Companies</span>
            </button>

<button
                onClick={() => handleViewModeToggle(viewMode === 'table' ? 'directory' : 'table')}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer ${
                  viewMode === 'directory'
                    ? 'bg-[#10b981]'
                    : 'bg-[#1a1a1a] border border-[#444] text-[#e5e7eb] hover:bg-[#333]'
                }`}
                title={viewMode === 'directory' ? 'Back to full contacts table' : 'Concise international importer directory (excl. Pakistan, A to Z)'}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{viewMode === 'directory' ? 'Full Table' : 'Intl Directory'}</span>
              </button>

              <button
                onClick={() => {
                  if (onOpenExport) {
                    onOpenExport({
                      dataset: 'contacts',
                      title: 'Company Contact Directory',
                      defaultReportType: contactExportReportType(filterType),
                      records: filteredContacts,
                      filenamePrefix: 'EdgeView_Contact_Directory',
                    });
                  } else {
                    setIsExportModalOpen(true);
                  }
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-white" />
                <span>Export Report</span>
              </button>

            <button
              onClick={handleRetryFailed}
              disabled={!researchAvailable}
              title={researchAvailable ? 'Research records that still need details' : researchReason}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-950/80"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Research Missing</span>
            </button>
          </div>
        </div>

        {researchCapability && !researchAvailable && (
          <div className="px-4 py-2 bg-amber-950/50 border-y border-amber-900/60 text-[11px] text-amber-200 flex items-start space-x-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Company research unavailable:</span> {researchReason}
              {researchRemediation && <span className="text-amber-300/80"> {researchRemediation}</span>}
            </div>
          </div>
        )}

        {/* Selected Items Floating Action Bar */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2 bg-sky-950/80 border-b border-sky-800 flex items-center justify-between text-xs text-white animate-fade-in">
            <span className="font-semibold flex items-center space-x-2 font-mono">
              <CheckSquare className="w-4 h-4 text-sky-400" />
              <span>{selectedIds.length} companies selected for batch action</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsBatchModalOpen(true)}
                disabled={!researchAvailable}
                title={researchAvailable ? 'Enrich selected companies' : researchReason}
                className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sky-600"
              >
                Enrich Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => {
                  if (onOpenExport) {
                    const selectedRecords = filteredContacts.filter((c) => selectedIds.includes(c.id));
                    onOpenExport({
                      dataset: 'contacts',
                      title: 'Selected Company Contacts',
                      defaultReportType: contactExportReportType(filterType),
                      records: selectedRecords.length > 0 ? selectedRecords : filteredContacts,
                      selectedRows: selectedIds,
                      filenamePrefix: 'EdgeView_Selected_Contacts',
                    });
                  } else {
                    setIsExportModalOpen(true);
                  }
                }}
                className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 font-bold transition-colors cursor-pointer"
              >
                Export Selected
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1 rounded bg-[#1a1a1a] hover:bg-[#333] border border-[#444] text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="p-4 bg-[#262626] border-b border-[#333333] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search company, CEO, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[#9ca3af] font-medium">Filter:</span>
            {[
              ['ALL', 'All companies'], ['IMPORTER', 'Importers'], ['RESEARCHED', 'Researched'],
              ['ENRICHED', 'Contact details found'], ['UNRESOLVED', 'Needs deeper research'],
              ['UNRESEARCHED', 'Not researched'], ['EXCLUDED', 'Excluded exporters'], ['EXPORTER', 'All exporters'],
            ].map(([t, label]) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  filterType === t
                    ? 'bg-[#10b981] text-white font-semibold'
                    : 'bg-[#1a1a1a] border border-[#333333] text-[#e5e7eb] hover:bg-[#333333]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Table */}
        {viewMode === 'directory' ? (
          <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
            <IntlDirectoryTable data={directoryData} loading={directoryLoading} onReload={loadDirectory} />
          </div>
        ) : (
        <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#262626] text-[#e5e7eb] font-bold sticky top-0 z-10 border-b border-[#333333] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center border-r border-[#333333]">
                  <button
                    onClick={toggleSelectAll}
                    className="text-[#9ca3af] hover:text-white transition-colors"
                    title={selectedIds.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
                  >
                    {selectedIds.length === filteredContacts.length && filteredContacts.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-sky-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-2.5 border-r border-[#333333]">Company & Domain</th>
                <th className="px-3 py-2.5 border-r border-[#333333]">Quality Status</th>
                <th className="px-3.5 py-2.5 border-r border-[#333333]">CEO / Contacts</th>
                <th className="px-4 py-2.5 border-r border-[#333333]">Email & Phone</th>
                <th className="px-3.5 py-2.5 border-r border-[#333333]">Social / Direct</th>
                <th className="px-3.5 py-2.5 text-center">Enrichment Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-[#e5e7eb]">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#9ca3af] italic bg-[#1a1a1a]">
                    No company contacts found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  const qStatus = contact.quality_status || (contact.email || contact.phone ? 'COMPLETE' : (contact as any).address || (contact as any).website ? 'PARTIAL' : 'PENDING');

                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-[#262626] transition-colors ${
                        isSelected ? 'bg-sky-950/30' : 'bg-[#1a1a1a]'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5 text-center border-r border-[#262626]">
                        <button
                          onClick={() => toggleSelectOne(contact.id)}
                          className="text-[#9ca3af] hover:text-white transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Company Name */}
                      <td className="px-4 py-2.5 border-r border-[#262626] font-semibold text-white space-y-1">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
                          <span className="truncate">{contact.company_name}</span>
                        </div>
                        {/* Role & Country Badges */}
                        <div className="flex flex-wrap gap-1.5 items-center pt-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-sky-950/80 border border-sky-800 text-sky-400 font-bold uppercase tracking-wider">
                            {contact.type || 'Other'}
                          </span>
                          {contact.country && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-purple-950/80 border border-purple-800 text-purple-400 font-bold uppercase tracking-wider">
                              {normalizeCountryName(contact.country)}
                            </span>
                          )}
                        </div>
                        {contact.website && (
                          <a
                            href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center space-x-1 text-[11px] text-sky-400 hover:underline font-mono"
                          >
                            <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{contact.website.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        )}
                        {contact.address && (
                          <div className="flex items-center space-x-1 text-[10px] text-gray-400 font-normal">
                            <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                            <span className="truncate max-w-[200px]" title={decodeDisplayText(contact.address)}>{decodeDisplayText(contact.address)}</span>
                          </div>
                        )}
                      </td>

                      {/* Quality Status Badge & Evidence Link */}
                      <td className="px-3 py-2.5 border-r border-[#262626] space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            qStatus === 'COMPLETE'
                              ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                              : qStatus === 'PARTIAL'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800'
                              : qStatus === 'NOT_FOUND'
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-red-950/60 text-red-400 border border-red-800'
                          }`}
                        >
                          {qStatus.replace('_', ' ')}
                        </span>

                        <button
                          onClick={() => setEvidenceContact(contact)}
                          className="flex items-center space-x-1 text-[10px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3 text-indigo-400" />
                          <span>View Intelligence</span>
                        </button>
                      </td>

                      {/* CEO / Decision Makers */}
                      <td className="px-3.5 py-2.5 border-r border-[#262626] font-medium">
                        {contact.contact_persons && contact.contact_persons.length > 0 ? (
                          <div className="space-y-1">
                            {contact.contact_persons.slice(0, 2).map((cp, idx) => (
                              <div key={idx} className="text-white">
                                <span className="font-semibold block truncate max-w-[170px]">{decodeDisplayText(cp.name)}</span>
                                {cp.designation && (
                                  <span className="text-[10px] text-gray-400 block truncate max-w-[170px]">
                                    {decodeDisplayText(cp.designation)}
                                  </span>
                                )}
                                {(cp as any).linkedin && (
                                  <a href={(cp as any).linkedin} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:underline inline-flex items-center gap-1">
                                    LinkedIn <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                            {contact.contact_persons.length > 2 && (
                              <button onClick={() => setEvidenceContact(contact)} className="text-[10px] font-semibold text-indigo-400 hover:underline">
                                +{contact.contact_persons.length - 2} more cited people
                              </button>
                            )}
                          </div>
                        ) : contact.decision_makers && contact.decision_makers.length > 0 && !contact.edgeview_v1_run_id ? (
                          <div className="space-y-1">
                            {contact.decision_makers.slice(0, 2).map((dm, idx) => (
                              <div key={dm.id || idx} className="text-white">
                                <span className="font-semibold block truncate max-w-[170px]">{dm.name}</span>
                                {dm.designation && (
                                  <span className="text-[10px] text-gray-400 block truncate max-w-[170px]">
                                    {dm.designation}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : contact.ceo ? (
                          <div>
                            <span className="text-white font-semibold block truncate max-w-[170px]">{contact.ceo}</span>
                            <span className="text-[10px] text-gray-400 block">CEO / Executive</span>
                          </div>
                        ) : (
                          <span className="text-[#9ca3af] italic font-mono text-[11px]">No cited leadership found</span>
                        )}
                      </td>

                      {/* Email & Phone */}
                      <td className="px-4 py-2.5 border-r border-[#262626] space-y-0.5">
                        {decodeDisplayText(contact.email) ? (
                          <div className="flex items-center space-x-1.5 text-[#10b981]">
                            <Mail className="w-3 h-3 text-[#10b981] shrink-0" />
                            <a href={`mailto:${decodeDisplayText(contact.email)}`} className="hover:underline font-mono truncate max-w-[180px]">
                              {decodeDisplayText(contact.email)}
                            </a>
                          </div>
                        ) : (
                          <span className="text-[#9ca3af] italic block font-mono">No Email</span>
                        )}
                        {(contact.emails_list?.length || 0) > 1 && <button onClick={() => setEvidenceContact(contact)} className="block text-[10px] text-indigo-400 hover:underline">+{(contact.emails_list?.length || 1) - 1} more emails</button>}

                        {contact.phone && (
                          <div className="flex items-center space-x-1.5 text-[#e5e7eb]">
                            <Phone className="w-3 h-3 text-[#9ca3af] shrink-0" />
                            <span className="font-mono">{decodeDisplayText(contact.phone)}</span>
                          </div>
                        )}
                        {(contact.phones_list?.length || 0) > 1 && <button onClick={() => setEvidenceContact(contact)} className="block text-[10px] text-indigo-400 hover:underline">+{(contact.phones_list?.length || 1) - 1} more phones</button>}
                      </td>

                      {/* WhatsApp & Socials */}
                      <td className="px-3.5 py-2.5 border-r border-[#262626] space-y-1">
                        {(contact.whatsapp || contact.whatsapp_details?.value) ? (
                          <div className="flex items-center space-x-1 font-mono text-[11px]">
                            <MessageSquare className="w-3 h-3 text-[#10b981] shrink-0" />
                            <span className="text-[#10b981] truncate">{contact.whatsapp || contact.whatsapp_details?.value}</span>
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase shrink-0 ${
                                contact.whatsapp_details?.status === 'verified'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : contact.whatsapp_details?.status === 'not_verified'
                                  ? 'bg-red-950 text-red-400 border border-red-800'
                                  : 'bg-gray-800 text-gray-400 border border-gray-700'
                              }`}
                            >
                              {contact.whatsapp_details?.status || 'Unknown'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#9ca3af] italic block text-[11px]">No WhatsApp</span>
                        )}

                        {contact.socials && contact.socials.length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {contact.socials.slice(0, 3).map((soc, sIdx) => (
                              <a
                                key={sIdx}
                                href={soc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-[#262626] hover:bg-[#333] border border-[#444] text-sky-400 hover:underline text-[10px]"
                              >
                                <span>{soc.platform}</span>
                                <ExternalLink className="w-2 h-2 shrink-0" />
                              </a>
                            ))}
                          </div>
                        ) : contact.linkedin ? (
                          <a
                            href={contact.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center space-x-1 text-blue-400 hover:underline text-[11px]"
                          >
                            <Linkedin className="w-3 h-3" />
                            <span>LinkedIn</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : null}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex flex-col items-center space-y-1.5">
                          <button
                            onClick={() => handleFetchDetails(contact.company_name, contact.id, false)}
                            disabled={fetchingDetailsId === contact.id || !researchAvailable}
                            className="w-full inline-flex items-center justify-center space-x-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/40 transition-colors shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#10b981]/20"
                            title={researchAvailable ? 'Fetch details (uses existing evidence where available)' : researchReason}
                          >
                            {fetchingDetailsId === contact.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-[#10b981]" />
                            ) : (
                              <Zap className="w-3 h-3 text-[#10b981]" />
                            )}
                            <span>Fetch Details</span>
                          </button>

                          <button
                            onClick={() => handleFetchDetails(contact.company_name, contact.id, true)}
                            disabled={fetchingDetailsId === contact.id || !researchAvailable}
                            className="w-full inline-flex items-center justify-center space-x-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-[#262626] hover:bg-[#333] text-[#e5e7eb] border border-[#444] transition-colors shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#262626]"
                            title={researchAvailable ? 'Force a fresh bounded V1 research run' : researchReason}
                          >
                            {fetchingDetailsId === contact.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-[#e5e7eb]" />
                            ) : (
                              <RefreshCw className="w-3 h-3 text-[#e5e7eb]" />
                            )}
                            <span>Force Fetch</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Table Footer & Pagination */}
        <div className="p-3 bg-[#262626] border-t border-[#333333] text-xs text-[#9ca3af] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Showing {paginatedContacts.length} of {filteredContacts.length} matching companies · {contacts.length} total</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <span className="text-[11px] text-gray-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#1a1a1a] border border-[#444] rounded px-1.5 py-0.5 text-white text-[11px]"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center space-x-1 font-mono text-[11px]">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#444] text-white disabled:opacity-40"
              >
                &laquo;
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#444] text-white disabled:opacity-40"
              >
                &lsaquo;
              </button>
              <span className="px-2 text-white">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#444] text-white disabled:opacity-40"
              >
                &rsaquo;
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#444] text-white disabled:opacity-40"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BatchEnrichmentModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        contacts={contacts}
        refreshData={refreshData}
      />

      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        contacts={contacts}
        selectedIds={selectedIds}
      />

      <SourceEvidenceModal
        isOpen={Boolean(evidenceContact)}
        onClose={() => setEvidenceContact(null)}
        contact={evidenceContact}
      />

    </div>
  );
};

// ---- International Importer Directory view (concise projection) ----

interface IntlDirectoryRow {
  country: string;
  importer: string;
  tradedWith: string;
  topProducts: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  leadership: string;
  sources: string;
  sNo: number;
}

interface IntlDirectory {
  title: string;
  countrySections: Array<{ country: string; importers: IntlDirectoryRow[] }>;
  totalImporters: number;
  excluded: { country: string; count: number };
  topProductsLimit: number;
}

function bullets(value: string): string[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export const IntlDirectoryTable: React.FC<{
  data: IntlDirectory | null;
  loading: boolean;
  onReload: () => void;
}> = ({ data, loading, onReload }) => {
  const [requestedPage, setDirectoryPage] = useState(() => {
    try { return Number(localStorage.getItem('edgeview_directory_page_v1')) || 1; } catch { return 1; }
  });
  const pageInfo = React.useMemo(() => getDirectoryPage(data?.countrySections || [], requestedPage), [data, requestedPage]);
  const directoryPage = pageInfo.page;
  const directoryTotalPages = pageInfo.totalPages;
  const pagedDirectorySections = pageInfo.sections;
  useEffect(() => {
    if (!data) return; // Loading must not erase the saved page before rows arrive.
    if (requestedPage !== directoryPage) setDirectoryPage(directoryPage);
    try { localStorage.setItem('edgeview_directory_page_v1', String(directoryPage)); } catch { /* Optional UI preference, never a reason to blank the directory. */ }
  }, [data, directoryPage, requestedPage]);

  if (loading && !data) {
    return (
      <div className="px-4 py-12 text-center text-[#9ca3af] italic text-sm bg-[#1a1a1a]">
        Loading international importer directory...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="px-4 py-12 text-center bg-[#1a1a1a]">
        <p className="text-[#9ca3af] italic text-sm">Unable to load directory.</p>
        <button
          onClick={onReload}
          className="mt-3 px-3 py-1.5 rounded-lg bg-[#262626] border border-[#444] text-white text-xs hover:bg-[#333] cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
    <table className="w-full text-xs text-left border-collapse">
      <thead className="bg-[#262626] text-[#e5e7eb] font-bold sticky top-0 z-10 border-b border-[#333333] uppercase tracking-wider">
        <tr>
          <th className="px-3 py-2.5 border-r border-[#333333] w-10 text-center">#</th>
          <th className="px-4 py-2.5 border-r border-[#333333]">Importer</th>
          <th className="px-3.5 py-2.5 border-r border-[#333333]">Traded With</th>
          <th className="px-3.5 py-2.5 border-r border-[#333333]">Top Products</th>
          <th className="px-3.5 py-2.5 border-r border-[#333333]">Contact & Leadership</th>
          <th className="px-3.5 py-2.5">Source</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#262626] text-[#e5e7eb]">
        {pageInfo.totalRows === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#9ca3af]">No international importers in this dataset.</td></tr>}
        {pagedDirectorySections.map((section) => (
          <React.Fragment key={section.country}>
            <tr className="bg-sky-950/40">
              <td colSpan={6} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                INTERNATIONAL IMPORTERS — {section.country}
                <span className="text-sky-500 font-mono normal-case ml-2">({section.importers.length} of {section.totalImporters} on this page)</span>
              </td>
            </tr>
            {section.importers.map((row) => {
              const tradedWith = bullets(row.tradedWith);
              const topProducts = bullets(row.topProducts);
              const contactLines = [row.website, row.email, row.phone, row.address].filter(Boolean);
              const leadershipLines = bullets(row.leadership);
              return (
                <tr key={row.sNo} className="hover:bg-[#262626] transition-colors align-top bg-[#1a1a1a]">
                  <td className="px-3 py-2.5 text-center border-r border-[#262626] text-[#9ca3af] font-mono">
                    {row.sNo}
                  </td>
                  <td className="px-4 py-2.5 border-r border-[#262626]">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                      <span className="font-semibold text-white">{row.importer}</span>
                    </div>
                    {row.website && (
                      <a
                        href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1 mt-1 text-[11px] text-sky-400 hover:underline font-mono"
                      >
                        <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{row.website.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-[#262626]">
                    <ul className="space-y-0.5">
                      {tradedWith.map((p, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-[#10b981]">•</span>
                          <span>{p.replace(/^[•\-\*]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-[#262626]">
                    <ul className="space-y-0.5">
                      {topProducts.map((p, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-[#10b981]">•</span>
                          <span>{p.replace(/^[•\-\*]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-[#262626] space-y-1">
                    {contactLines.length === 0 && leadershipLines.length === 0 ? (
                      <span className="text-[#9ca3af] italic font-mono text-[11px]">—</span>
                    ) : (
                      <>
                        {leadershipLines.map((l, i) => (
                          <div key={i} className="text-white">
                            <span className="font-medium">{l.replace(/^[•\-\*]\s*/, '')}</span>
                          </div>
                        ))}
                        {contactLines.map((l, i) => (
                          <div key={`c${i}`} className="flex items-center space-x-1.5 text-[#e5e7eb]">
                            {l.startsWith('http') ? (
                              <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                            ) : l.includes('@') ? (
                              <Mail className="w-3 h-3 text-[#10b981] shrink-0" />
                            ) : (
                              <Phone className="w-3 h-3 text-[#9ca3af] shrink-0" />
                            )}
                            <span className="font-mono truncate max-w-[180px]">{l}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {row.sources ? (
                      <span className="text-[10px] text-gray-400 font-mono">{row.sources}</span>
                    ) : (
                      <span className="text-[#9ca3af] italic font-mono text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </React.Fragment>
        ))}
      </tbody>
    </table>
    <nav aria-label="International importer pages" className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#333333] bg-[#262626] px-4 py-2 text-[11px] text-[#9ca3af]">
      <span aria-live="polite">Showing {pageInfo.start}-{pageInfo.end} of {pageInfo.totalRows} importers</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous directory page"
          disabled={directoryPage <= 1}
          onClick={() => setDirectoryPage(Math.max(1, directoryPage - 1))}
          className="rounded border border-[#444] bg-[#1a1a1a] px-2 py-1 text-white disabled:opacity-40"
        >Previous</button>
        <span className="font-mono text-[#e5e7eb]">Page {directoryPage} of {directoryTotalPages}</span>
        <button
          type="button"
          aria-label="Next directory page"
          disabled={directoryPage >= directoryTotalPages}
          onClick={() => setDirectoryPage(Math.min(directoryTotalPages, directoryPage + 1))}
          className="rounded border border-[#444] bg-[#1a1a1a] px-2 py-1 text-white disabled:opacity-40"
        >Next</button>
      </div>
    </nav>
    </>
  );
};
