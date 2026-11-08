import React, { useState, useEffect, useRef } from 'react';
import { CompanyContact } from '../types';
import { normalizeBatchJobSnapshot, observedBatchUsage, type BatchUsage, type ResearchJob, type CompanyResearchState } from '../utils/batchSnapshot';
import { formatObservedCount } from '../utils/telemetryFormat';
import { V1_REUSE_MAX_AGE_DAYS } from '../../shared/v1_contact_contract';
import { 
  Bot, Sparkles, Building2, CheckSquare, Square, X, RefreshCw, 
  Play, Pause, Sliders, AlertTriangle, Activity, CheckCircle2, 
  Clock, ChevronDown, ChevronUp, Check, ShieldAlert
} from 'lucide-react';

interface BatchEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: CompanyContact[];
  refreshData?: () => void;
  evidenceOnly?: boolean;
}

export const BatchEnrichmentModal: React.FC<BatchEnrichmentModalProps> = ({
  isOpen,
  onClose,
  contacts: suppliedContacts,
  refreshData,
  evidenceOnly = false,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'importers' | 'exporters'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reportMode, setReportMode] = useState<'importer' | 'exporter'>('importer');
  const [researchMode, setResearchMode] = useState<'recent' | 'saved' | 'live'>('recent');
  const savedMode = evidenceOnly || researchMode === 'saved';
  const contacts = savedMode ? suppliedContacts.filter(contact => contact.can_revalidate_evidence === true) : suppliedContacts;
  
  // Job Tracking
  const [controlError, setControlError] = useState<string | null>(null);
  const [controlAction, setControlAction] = useState<'pause' | 'resume' | null>(null);
  const controlRequestRef = useRef<AbortController | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<ResearchJob | null>(null);
  const [historicalJobs, setHistoricalJobs] = useState<any[]>([]);
  
  // Governor
  const [govStats, setGovStats] = useState<BatchUsage>(() => observedBatchUsage(null));
  
  // View states
  const [showGovPanel, setShowGovPanel] = useState(true);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollRequestRef = useRef<AbortController | null>(null);
  const openRef = useRef(isOpen);
  openRef.current = isOpen;

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    const type = (c.type || '').toLowerCase();
    if (filterType === 'importers') return type.includes('importer') || type === 'both';
    if (filterType === 'exporters') return type.includes('exporter') || type === 'both';
    return true;
  });

  // Load Governor Info
  const fetchGovernorInfo = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/governor/stats', { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.success && !signal?.aborted && openRef.current) {
          setGovStats(observedBatchUsage(data.stats));
        }
      }
    } catch (err) {
      if (!signal?.aborted) console.error('Failed to fetch provider usage', err);
    }
  };

  // Load History of Jobs
  const fetchHistoricalJobs = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/enrich/jobs', { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.success && !signal?.aborted && openRef.current) {
          setHistoricalJobs(data.jobs);
        }
      }
    } catch (err) {
      if (!signal?.aborted) console.error('Failed to fetch jobs history', err);
    }
  };

  const reattachActiveJob = async (signal: AbortSignal) => {
    try {
      const res = await fetch('/api/enrich/job/active', { signal });
      if (!res.ok) return false;
      const data = await res.json();
      const summary = data.success ? normalizeBatchJobSnapshot(data.job) : null;
      if (!summary || signal.aborted || !openRef.current) return false;
      // The active endpoint is intentionally a bounded summary. Hydrate the
      // complete job once before rendering so refresh does not present an empty
      // company table and then replace it with only the latest five results.
      const fullRes = await fetch(`/api/enrich/job/${encodeURIComponent(summary.id)}`, { signal });
      if (!fullRes.ok) return false;
      const fullData = await fullRes.json();
      const job = fullData.success ? normalizeBatchJobSnapshot(fullData.job) : null;
      if (!job || signal.aborted || !openRef.current) return false;
      setJobData(job);
      setReportMode(job.importer_exporter_mode);
      startPolling(job.id);
      return true;
    } catch (err) {
      if (!signal.aborted) console.error('Failed to restore active research job', err);
      return false;
    }
  };

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    if (isOpen) {
      setResearchMode('recent');
      setControlError(null);
      setControlAction(null);
      fetchGovernorInfo(controller.signal);
      fetchHistoricalJobs(controller.signal);
      void reattachActiveJob(controller.signal).then((restored) => {
        if (!controller.signal.aborted && !restored) setSelectedIds(new Set());
      });
    } else {
      stopPolling();
    }
    return () => {
      controller.abort(); controlRequestRef.current?.abort(); controlRequestRef.current = null; stopPolling();
    };
  }, [isOpen]);

  // Toggle selection
  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const toggleContact = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectSingleCompany = () => {
    const first = filteredContacts[0];
    if (first) {
      setSelectedIds(new Set([first.id]));
    }
  };

  const selectAllImporters = () => {
    setFilterType('importers');
    setReportMode('importer');
    const importers = contacts.filter(c => {
      const type = (c.type || '').toLowerCase();
      return type.includes('importer') || type === 'both';
    });
    setSelectedIds(new Set(importers.map(c => c.id)));
  };

  const selectAllExporters = () => {
    setFilterType('exporters');
    setReportMode('exporter');
    const exporters = contacts.filter(c => {
      const type = (c.type || '').toLowerCase();
      return type.includes('exporter') || type === 'both';
    });
    setSelectedIds(new Set(exporters.map(c => c.id)));
  };

  const selectFullEnrichment = () => {
    setFilterType('all');
    setSelectedIds(new Set(contacts.map(c => c.id)));
  };

  const selectSelectedImporters = () => {
    setFilterType('importers');
    setReportMode('importer');
    const currentImporters = Array.from(selectedIds).filter(id => {
      const c = contacts.find(co => co.id === id);
      const type = (c?.type || '').toLowerCase();
      return Boolean(c) && (type.includes('importer') || type === 'both');
    });
    if (currentImporters.length === 0) {
      const importers = contacts.filter(c => {
        const type = (c.type || '').toLowerCase();
        return type.includes('importer') || type === 'both';
      });
      setSelectedIds(new Set(importers.map(c => c.id)));
    } else {
      setSelectedIds(new Set(currentImporters));
    }
  };

  const selectSelectedExporters = () => {
    setFilterType('exporters');
    setReportMode('exporter');
    const currentExporters = Array.from(selectedIds).filter(id => {
      const c = contacts.find(co => co.id === id);
      const type = (c?.type || '').toLowerCase();
      return Boolean(c) && (type.includes('exporter') || type === 'both');
    });
    if (currentExporters.length === 0) {
      const exporters = contacts.filter(c => {
        const type = (c.type || '').toLowerCase();
        return type.includes('exporter') || type === 'both';
      });
      setSelectedIds(new Set(exporters.map(c => c.id)));
    } else {
      setSelectedIds(new Set(currentExporters));
    }
  };

  // Start polling
  const startPolling = (jobId: string) => {
    stopPolling();
    if (!openRef.current) return;
    const controller = new AbortController();
    pollRequestRef.current = controller;
    let busy = false;
    setActiveJobId(jobId);
    
    const poll = async () => {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const res = await fetch(`/api/enrich/job/${encodeURIComponent(jobId)}/progress`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.success && !controller.signal.aborted) {
            const progress = data.progress;
            setJobData(previous => {
              const priorStates = previous?.company_states || {};
              const recentStates = Object.fromEntries((Array.isArray(progress.recent_results) ? progress.recent_results : [])
                .filter((item: any) => item && typeof item.name === 'string')
                .map((item: any, index: number) => {
                  const existing = Object.entries(priorStates).find(([, state]) => state.name === item.name);
                  const id = existing?.[0] || `recent-${index}-${item.name}`;
                  return [id, { ...(existing?.[1] || {}), id, name: item.name, status: item.status, stage: item.stage,
                    error: item.error, durationMs: item.durationMs, resourceUsage: observedBatchUsage(item.resourceUsage), metrics: item.metrics }];
                }));
              return normalizeBatchJobSnapshot({
                ...(previous || {} as ResearchJob),
                ...progress,
                company_ids: previous?.company_ids || [],
                // Progress is intentionally bounded. Preserve full hydration
                // and merge the observed updates onto their existing rows.
                company_states: { ...priorStates, ...recentStates },
              }) || previous;
            });
            
            // Check if job finished or hit limit
            const status = progress.status;
            if (['COMPLETED', 'FAILED', 'STOPPED', 'RESOURCE_LIMITED'].includes(status)) {
              setControlError(null);
              stopPolling();
              // Trigger a background refetch on the parent to load newly enriched contacts on list
              if (refreshData) refreshData();
            }
          }
        }
        // Also refresh governor metrics
        if (!controller.signal.aborted) await fetchGovernorInfo(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) console.error('Polling error', err);
      } finally { busy = false; }
    };
    void poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  };

  const stopPolling = () => {
    pollRequestRef.current?.abort();
    pollRequestRef.current = null;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Actions
  const handleCreateAndStartJob = async (ids: string[]) => {
    try {
      // 1. Create Job in backend
      const resCreate = await fetch('/api/enrich/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: ids, mode: reportMode, reuseOnly: savedMode, forceFetch: !savedMode && researchMode === 'live' }),
      });
      const createData = await resCreate.json();
      if (!resCreate.ok || !createData.success) throw new Error(createData.message || createData.error || 'Failed to create job');

      const jobId = createData.jobId;
      setActiveJobId(jobId);

      // 2. Start Job execution
      const resStart = await fetch(`/api/enrich/job/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFetch: false }),
      });
      if (!resStart.ok) { const failure = await resStart.json(); throw new Error(failure.message || failure.error || 'Failed to start research job'); }

      // 3. Start Polling
      startPolling(jobId);
    } catch (err: any) {
      alert(err.message || 'Error occurred starting job');
    }
  };

  const handlePauseJob = async () => {
    if (!activeJobId || controlAction !== null) return;
    const controller = new AbortController();
    controlRequestRef.current = controller;
    setControlAction('pause');
    setControlError(null);
    let acknowledged = false;
    const timeout = setTimeout(() => {
      if (controller.signal.aborted || controlRequestRef.current !== controller) return;
      // Retire this request before cancellation. Transport/body settlement may
      // lag or never arrive; it must not own the UI deadline or a later retry.
      controlRequestRef.current = null;
      controller.abort();
      if (openRef.current) {
        setControlAction(null);
        setControlError(acknowledged
          ? 'Stop was requested, but its checkpoint could not be confirmed. EdgeView will keep checking.'
          : 'Pausing took too long. The stop result is unknown; EdgeView will keep checking.');
        if (acknowledged) startPolling(activeJobId);
      }
    }, 15000);
    try {
      const res = await fetch(`/api/enrich/job/${encodeURIComponent(activeJobId)}/stop`, {
        method: 'POST', signal: controller.signal,
      });
      const result = await res.json();
      if (controller.signal.aborted || !openRef.current) return;
      if (!res.ok || result.success !== true) throw new Error('Stop refused');
      acknowledged = true;
      const checkpoint = await fetch(`/api/enrich/job/${encodeURIComponent(activeJobId)}`, { signal: controller.signal });
      if (!checkpoint.ok) throw new Error('Checkpoint unavailable');
      const data = await checkpoint.json();
      const job = data.success ? normalizeBatchJobSnapshot(data.job) : null;
      if (!job) throw new Error('Checkpoint invalid');
      if (controller.signal.aborted || !openRef.current) return;
      setJobData(job);
      if (['STOPPED', 'COMPLETED', 'FAILED', 'RESOURCE_LIMITED'].includes(job.status)) {
        stopPolling();
        refreshData?.();
      } else {
        setControlError('Stop requested. Finishing current work; EdgeView is checking the checkpoint.');
        startPolling(activeJobId);
      }
    } catch {
      if (openRef.current && controlRequestRef.current === controller && !controller.signal.aborted) {
        setControlError(acknowledged
          ? 'Stop was requested, but its checkpoint could not be confirmed. EdgeView will keep checking.'
          : 'Could not pause research. Check that EdgeView is running and try again.');
        if (acknowledged) startPolling(activeJobId);
      }
    } finally {
      clearTimeout(timeout);
      if (controlRequestRef.current === controller) {
        controlRequestRef.current = null;
        if (openRef.current) setControlAction(null);
      }
    }
  };

  const handleResumeJob = async () => {
    if (!activeJobId || controlAction !== null) return;
    const controller = new AbortController();
    controlRequestRef.current = controller;
    setControlAction('resume');
    setControlError(null);
    const timeout = setTimeout(() => {
      if (controller.signal.aborted || controlRequestRef.current !== controller) return;
      controlRequestRef.current = null;
      controller.abort();
      if (openRef.current) {
        setControlAction(null);
        setControlError('Resuming took too long. The result is unknown; check research status before retrying.');
      }
    }, 15000);
    try {
      const res = await fetch(`/api/enrich/job/${encodeURIComponent(activeJobId)}/start`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFetch: false }),
      });
      const result = await res.json();
      if (!openRef.current || controller.signal.aborted) return;
      if (!res.ok || result.success !== true) {
        setControlError(result.code === 'JOB_DRAINING'
          ? 'Previous research work is finishing. Try resuming shortly.'
          : 'Could not resume research. Check that EdgeView is running and try again.');
        return;
      }
      startPolling(activeJobId);
    } catch {
      if (openRef.current && controlRequestRef.current === controller && !controller.signal.aborted) {
        setControlError('Could not resume research. Check that EdgeView is running and try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (controlRequestRef.current === controller) {
        controlRequestRef.current = null;
        if (openRef.current) setControlAction(null);
      }
    }
  };

  const states = Object.values(jobData?.company_states || {});
  const queued = states.filter(state => state.status === 'pending' || state.status === 'processing');
  const relevantStates = queued.length ? queued : states;
  const modeNotice = !relevantStates.length ? 'Research mode has not been loaded yet.'
    : relevantStates.some(state => state.force_live === true) ? 'Live refresh was requested. Resuming may use provider quota.'
    : relevantStates.every(state => state.reuse_only === true) ? 'Saved-evidence review only. Queued items cannot call providers.'
    : relevantStates.every(state => state.reuse_policy_version === 1) ? `Recent-result mode: compatible completed results up to ${V1_REUSE_MAX_AGE_DAYS} days old; new companies may use providers.`
    : 'Legacy job: saved results are historical rechecks; new companies may use providers.';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-[#121212] rounded-xl shadow-2xl w-full max-w-4xl border border-[#2d2d2d] flex flex-col max-h-[90vh]">
        
        {/* Header Title Bar */}
        <div className="px-6 py-4 border-b border-[#2d2d2d] flex items-center justify-between bg-[#181818] rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-sky-950/80 flex items-center justify-center border border-sky-800">
              <Bot className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">{savedMode ? 'Review Saved Evidence' : 'EdgeView V1 Batch Enrichment'}</h3>
              <p className="text-[11px] text-[#9ca3af]">{savedMode ? 'Recheck retained sources for the same company and country. No provider calls.' : 'Exact identity queries, deterministic retrieval, immutable evidence, resumable progress'}</p>
              {jobData && <p role="status" className="mt-1 text-xs text-amber-200">{modeNotice}</p>}
            </div>
          </div>
          <button 
            aria-label="Close batch enrichment"
            onClick={onClose} 
            disabled={jobData?.status === 'PENDING' || jobData?.status === 'DISCOVERING'} 
            className="text-[#9ca3af] hover:text-white p-1 rounded-md hover:bg-[#2a2a2a] transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Dual-Layout Panels (Interactive Dashboard) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT AREA: Work Queue, Selection or Active Run */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 border-r border-[#2d2d2d]">
            
            {activeJobId && jobData ? (
              // ACTIVE RUN OVERVIEW
              <div className="space-y-5">
                <div className="flex items-center justify-between p-3 bg-[#181818] rounded-lg border border-[#2d2d2d]">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">ACTIVE JOB ID</span>
                    <span className="text-xs font-mono text-white">{jobData.id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      jobData.status === 'COMPLETED' ? 'bg-[#064e3b] text-[#34d399] border-[#065f46]' :
                      jobData.status === 'RESOURCE_LIMITED' ? 'bg-[#78350f] text-amber-400 border-[#92400e]' :
                      ['PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING'].includes(jobData.status) ? 'bg-[#0369a1] text-sky-200 border-[#075985] animate-pulse' :
                      'bg-[#2d2d2d] text-gray-300 border-[#404040]'
                    }`}>
                      {jobData.status}
                    </span>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 text-gray-300">
                    <span className="font-semibold flex items-center space-x-2">
                      <Activity className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                      <span>Processed {jobData.completed_companies} / {jobData.total_companies} Companies</span>
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      {Math.round((jobData.completed_companies / jobData.total_companies) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-[#262626] h-2.5 rounded-full overflow-hidden border border-[#3c3c3c]">
                    <div 
                      className="bg-sky-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(jobData.completed_companies / jobData.total_companies) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Active Stage & Company Card */}
                {['PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING'].includes(jobData.status) && (
                  <div className="p-3 bg-sky-950/20 border border-sky-900/60 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-sky-400 font-bold uppercase tracking-widest block">CURRENT EXTRACTION STEP</span>
                      <span className="text-xs text-white font-semibold mt-0.5 block">{jobData.current_company || 'Initializing...'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-xs text-sky-300">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Stage: <span className="font-bold text-white">{jobData.current_stage || 'Planner'}</span></span>
                    </div>
                  </div>
                )}

                {/* Checkpoint / Resource Limit message */}
                {jobData.status === 'RESOURCE_LIMITED' && (
                  <div className="p-3 bg-amber-950/20 border border-amber-900/60 rounded-lg space-y-1">
                    <div className="flex items-center space-x-1.5 text-amber-400 font-semibold text-xs">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Checkpoint Safe Halt — Limit Reached</span>
                    </div>
                    <p className="text-[10px] text-amber-200/80 leading-relaxed">
                      {jobData.error_message || 'A resource limit threshold was hit. Queue traversal has been paused and checkpointed. Please raise limits on the right side to resume safely.'}
                    </p>
                  </div>
                )}

                {/* Real-time individual worker table logs */}
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Recent Company Activity</span>
                  <div className="border border-[#2d2d2d] rounded-lg overflow-hidden max-h-[220px] overflow-y-auto bg-[#0c0c0c] custom-scrollbar">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-[#181818] text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#2d2d2d] sticky top-0">
                        <tr>
                          <th className="p-2">Company</th>
                          <th className="p-2 text-center">Status</th>
                          <th className="p-2 text-right">Metrics Found</th>
                          <th className="p-2 text-right">Resources Used</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e1e1e]">
                        {(Object.values(jobData.company_states) as CompanyResearchState[]).map((st) => (
                          <tr key={st.id} className="hover:bg-[#151515] transition-colors">
                            <td className="p-2 text-white font-medium max-w-[150px] truncate">{st.name}</td>
                            <td className="p-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                st.status === 'completed' ? 'bg-[#064e3b] text-emerald-300' :
                                st.status === 'processing' ? 'bg-sky-950 text-sky-300 animate-pulse' :
                                st.status === 'failed' ? 'bg-rose-950 text-rose-300' :
                                'bg-[#181818] text-gray-400'
                              }`}>
                                {st.status === 'processing' ? st.stage : st.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-2 text-right text-gray-300">
                              {st.metrics ? (
                                <div className="space-x-1.5 font-mono text-[9px]">
                                  {st.metrics.emailsFound > 0 && <span title="Emails" className="text-emerald-400">📧 {st.metrics.emailsFound}</span>}
                                  {st.metrics.phonesFound > 0 && <span title="Phones" className="text-sky-400">📞 {st.metrics.phonesFound}</span>}
                                  {st.metrics.websiteFound && <span title="Website Verified" className="text-[#a855f7]">🌐 Verified</span>}
                                </div>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono text-[10px] text-gray-400">
                              Serper {formatObservedCount(st.resourceUsage.serper)} | Hunter {formatObservedCount(st.resourceUsage.hunter)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {controlError && <p role="alert" className="text-xs text-amber-300">{controlError}</p>}
                {/* Queue Actions (Pause/Resume/Checkpoint reset) */}
                <div className="flex items-center space-x-3 pt-1">
                  {['PENDING', 'DISCOVERING', 'CRAWLING', 'EXTRACTING'].includes(jobData.status) ? (
                    <button
                      onClick={handlePauseJob}
                      disabled={controlAction !== null}
                      className="flex-1 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-lg text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Pause className="w-4 h-4" />
                      <span>{controlAction === 'pause' ? 'Pausing…' : 'Pause / Halt Traversal'}</span>
                    </button>
                  ) : (
                    jobData.status !== 'COMPLETED' && (
                      <button
                        onClick={handleResumeJob}
                        disabled={controlAction !== null}
                        className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        <span>{controlAction === 'resume' ? 'Resuming…' : 'Resume from Checkpoint'}</span>
                      </button>
                    )
                  )}
                  
                  <button
                    onClick={() => {
                      controlRequestRef.current?.abort();
                      controlRequestRef.current = null;
                      setControlAction(null);
                      stopPolling();
                      setActiveJobId(null);
                      setJobData(null);
                      setControlError(null);
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Back to Config
                  </button>
                </div>
              </div>
            ) : (
              // INITIAL QUEUE CONFIGURATION & STARTUP
              <div className="flex flex-col h-full space-y-4">
                {!evidenceOnly && <div className="text-xs text-[#ccc]">
                  <label>Research mode
                  <select aria-label="Research mode" value={researchMode} onChange={event => { setResearchMode(event.target.value as 'recent' | 'saved' | 'live'); setSelectedIds(new Set()); }} className="ml-2 rounded border border-[#444] bg-[#181818] p-2">
                    <option value="recent">{`Reuse compatible completed results up to ${V1_REUSE_MAX_AGE_DAYS} days old`}</option>
                    <option value="saved">Recheck saved evidence — no provider calls</option>
                    <option value="live">Refresh live — uses provider quota</option>
                  </select></label>
                  <p className="mt-1 text-[11px] text-[#999]">Recent mode researches new companies. Older, partial or incompatible saved results require an explicit choice.</p>
                </div>}
                
                {/* Mode Selectors */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">Enrichment Scope Mode</label>
                    <select
                      value={reportMode}
                      onChange={(e) => setReportMode(e.target.value as any)}
                      className="w-full bg-[#181818] border border-[#2d2d2d] rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="importer">Importer Report Focus</option>
                      <option value="exporter">Exporter Report Focus</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1 font-bold">List Filter</label>
                    <div className="flex bg-[#181818] p-0.5 rounded-lg border border-[#2d2d2d]">
                      {(['all', 'importers', 'exporters'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setFilterType(t)}
                          className={`flex-1 py-1 text-[10px] font-semibold rounded capitalize transition-all ${
                            filterType === t ? 'bg-[#2d2d2d] text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 6 Research Scopes & Live Estimates */}
                <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Configure Research Scope Presets</span>
                    </div>
                    {selectedIds.size > 0 && !savedMode && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
                        Est: ~{(selectedIds.size * 12 / 60).toFixed(1)}m duration
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={selectSingleCompany}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-[#2d2d2d] hover:border-sky-500 rounded text-left transition-all group cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-sky-400 group-hover:text-sky-300">Single Company</div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5 truncate">Enrich 1 company</div>
                    </button>
                    <button
                      type="button"
                      onClick={selectSelectedImporters}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-[#2d2d2d] hover:border-emerald-500 rounded text-left transition-all group cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300">Selected Importers</div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5 truncate">Checked importers</div>
                    </button>
                    <button
                      type="button"
                      onClick={selectSelectedExporters}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-[#2d2d2d] hover:border-amber-500 rounded text-left transition-all group cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-amber-400 group-hover:text-amber-300">Selected Exporters</div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5 truncate">Checked exporters</div>
                    </button>
                    <button
                      type="button"
                      onClick={selectAllImporters}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-[#2d2d2d] hover:border-purple-500 rounded text-left transition-all group cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-purple-400 group-hover:text-purple-300">All Importers</div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5 truncate">All importers ({contacts.filter(c => {
                        const type = (c.type || '').toLowerCase();
                        return type.includes('importer') || type === 'both';
                      }).length})</div>
                    </button>
                    <button
                      type="button"
                      onClick={selectAllExporters}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-[#2d2d2d] hover:border-pink-500 rounded text-left transition-all group cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-[#ec4899] group-hover:text-pink-300">All Exporters</div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5 truncate">All exporters ({contacts.filter(c => (c.type || '').toLowerCase().includes('exporter')).length})</div>
                    </button>
                    <button
                      type="button"
                      onClick={selectFullEnrichment}
                      className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-[#2d2d2d] hover:border-rose-500 rounded text-left transition-all group cursor-pointer"
                    >
                      <div className="text-[11px] font-bold text-rose-400 group-hover:text-rose-300">Full Enrichment</div>
                      <div className="text-[9px] text-[#9ca3af] mt-0.5 truncate">All contacts ({contacts.length})</div>
                    </button>
                  </div>

                  {selectedIds.size > 0 && (
                    <div className="pt-1.5 border-t border-[#2d2d2d] text-[10px] text-gray-400">
                      Provider usage depends on enabled services, available evidence and retries. Account quota and completion time are not known in advance.
                    </div>
                  )}
                </div>

                {/* Company checklist box */}
                <div className="flex-1 flex flex-col space-y-2 min-h-0">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={toggleAll} 
                      className="text-sky-400 hover:text-sky-300 flex items-center space-x-1.5 focus:outline-none"
                    >
                      {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span className="text-xs font-medium">Toggle All Selection ({filteredContacts.length})</span>
                    </button>
                    <span className="text-[10px] text-gray-400 font-mono">Selected: {selectedIds.size}</span>
                  </div>

                  <div className="flex-1 border border-[#2d2d2d] rounded-lg overflow-y-auto p-2 bg-[#0c0c0c] space-y-1.5 custom-scrollbar max-h-[300px]">
                    {filteredContacts.length === 0 ? (
                      <p className="text-xs text-[#9ca3af] italic p-3 text-center">No companies match this filter.</p>
                    ) : (
                      filteredContacts.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => toggleContact(c.id)}
                          className="flex items-center space-x-3 p-2 rounded-lg border border-[#2d2d2d] hover:bg-[#1a1a1a] transition-colors bg-[#181818]/60 cursor-pointer"
                        >
                          <div className={selectedIds.has(c.id) ? 'text-sky-500' : 'text-[#6b7280]'}>
                            {selectedIds.has(c.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-white truncate">{c.company_name}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded border border-[#333333] text-[#9ca3af] capitalize bg-[#121212]">
                                {c.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Start buttons */}
                <div className="pt-2 flex space-x-3">
                  <button
                    disabled={selectedIds.size === 0}
                    onClick={() => handleCreateAndStartJob(Array.from(selectedIds))}
                    className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Enrich Selection ({selectedIds.size})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT AREA: Governor Stats, Limits Adjustment & Job History */}
          <div className="w-[320px] bg-[#181818] p-5 flex flex-col space-y-4 overflow-y-auto">
            
            {/* GOVERNOR COLLAPSIBLE PANEL */}
            <div className="border border-[#2d2d2d] rounded-lg overflow-hidden bg-[#121212]">
              <button 
                onClick={() => setShowGovPanel(!showGovPanel)}
                className="w-full p-3 bg-[#1e1e1e] flex items-center justify-between text-xs font-bold text-white tracking-wide border-b border-[#2d2d2d]"
              >
                <span className="flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <span>LATEST ACTIVE JOB USAGE</span>
                </span>
                {showGovPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showGovPanel && (
                <div className="p-3.5 space-y-4">
                  {/* Observed local calls, not guessed provider account quotas. */}
                  <div className="space-y-3 text-xs">
                    {(['serper', 'hunter', 'nvidia', 'groq'] as const).map(provider => (
                      <div key={provider} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-300 font-medium">{provider === 'nvidia' ? 'NVIDIA NIM' : provider === 'groq' ? 'Groq' : provider === 'hunter' ? 'Hunter' : 'Serper'}</span>
                        <span className="font-mono text-gray-400">{formatObservedCount(govStats[provider])} calls</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-500">Local job counts, not account balances. No active job or unreported usage stays unknown.</p>

                  </div>

                </div>
              )}
            </div>

            {/* HISTORICAL JOBS LIST PANEL */}
            <div className="border border-[#2d2d2d] rounded-lg overflow-hidden bg-[#121212]">
              <button 
                onClick={() => {
                  setShowHistoryPanel(!showHistoryPanel);
                  if (!showHistoryPanel) fetchHistoricalJobs();
                }}
                className="w-full p-3 bg-[#1e1e1e] flex items-center justify-between text-xs font-bold text-white tracking-wide border-b border-[#2d2d2d]"
              >
                <span className="flex items-center space-x-1.5">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span>RESEARCH JOB HISTORIES</span>
                </span>
                {showHistoryPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showHistoryPanel && (
                <div className="p-2.5 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                  {historicalJobs.length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic text-center py-2">No historical jobs found.</p>
                  ) : (
                    historicalJobs.map((hj) => (
                      <div 
                        key={hj.id}
                        onClick={() => startPolling(hj.id)}
                        className={`p-2 bg-[#1c1c1c] border rounded-md hover:bg-[#262626] cursor-pointer transition-colors ${
                          activeJobId === hj.id ? 'border-sky-500' : 'border-[#2d2d2d]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-white truncate max-w-[120px]">{hj.id}</span>
                          <span className={`text-[8px] font-bold px-1.5 rounded ${
                            hj.status === 'COMPLETED' ? 'bg-[#064e3b] text-emerald-300' :
                            hj.status === 'RESOURCE_LIMITED' ? 'bg-amber-950 text-amber-300' :
                            'bg-[#2d2d2d] text-gray-400'
                          }`}>
                            {hj.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[9px] text-gray-400">
                          <span>{hj.completed_companies}/{hj.total_companies} Companies</span>
                          <span className="capitalize">{hj.importer_exporter_mode}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* PIPELINE ARCHITECTURAL SCHEMATIC */}
            <div className="p-3 bg-[#121212] border border-[#2d2d2d] rounded-lg">
              <span className="text-[10px] text-[#9ca3af] uppercase font-bold tracking-widest block mb-1">Frozen V1 Pipeline</span>
              <div className="space-y-1.5 text-[10px] text-[#9ca3af]">
                <div className="flex items-center space-x-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div><span>1. Exact company name + country</span></div>
                <div className="flex items-center space-x-2"><div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div><span>2. AI generates identity-anchored queries only</span></div>
                <div className="flex items-center space-x-2"><div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div><span>3. Deterministic provider retrieval and capture</span></div>
                <div className="flex items-center space-x-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span>4. Immutable raw evidence + normalized display</span></div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#2d2d2d] bg-[#181818] rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#2d2d2d] hover:bg-[#3d3d3d] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Close Pipeline Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};
