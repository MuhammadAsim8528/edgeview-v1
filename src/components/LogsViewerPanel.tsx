import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Terminal, RefreshCw, Search } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';
import { normalizeActivityLogs, type ActivityLogRow, type ActivityLogTab } from '../utils/activityLogs';

export const LogsViewerPanel: React.FC = () => {
  const formatLogTime = (value: unknown) => {
    const date = new Date(String(value || ''));
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString();
  };
  const [activeTab, setActiveTab] = useState<ActivityLogTab>('enrichment');
  const [snapshot, setSnapshot] = useState<{ tab: ActivityLogTab; rows: ActivityLogRow[]; error: string | null } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const activeRequest = useRef<AbortController | null>(null);
  const view = snapshot?.tab === activeTab ? snapshot : null;
  const busy = loading || !view;
  const visibleCount = !busy && view && (!view.error || view.rows.length > 0) ? view.rows.length : '—';

  const fetchLogs = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    try {
      const result = await safeFetchJson<unknown>(`/api/logs/${activeTab}?tail=500`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
      if (activeRequest.current !== controller) return;
      const rows = result.ok ? normalizeActivityLogs(result.data, activeTab) : null;
      if (rows) setSnapshot({ tab: activeTab, rows, error: null });
      else setSnapshot(previous => ({ tab: activeTab, rows: previous?.tab === activeTab ? previous.rows : [], error: 'Activity logs could not be loaded. Retry to refresh.' }));
    } catch {
      if (activeRequest.current === controller) setSnapshot(previous => ({ tab: activeTab, rows: previous?.tab === activeTab ? previous.rows : [], error: 'Activity logs could not be loaded. Retry to refresh.' }));
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setLoading(false); }
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchLogs();
    return () => { const request = activeRequest.current; activeRequest.current = null; request?.abort(); };
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (view?.rows || []).filter(log => !q || [log.message, log.subsystem, log.company, log.details].some(value => value.toLowerCase().includes(q)));
  }, [view, searchQuery]);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#333333] p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#333333]">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white">System Diagnostics & Activity Logs</h3>
            <p className="text-xs text-[#9ca3af]">
              Technical event logs, enrichment diagnostics, and persistence synchronization logs
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchLogs}
            disabled={busy}
            className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#333333] text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[#333333] pb-2 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('enrichment')}
            aria-pressed={activeTab === 'enrichment'}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'enrichment'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            Enrichment Logs ({activeTab === 'enrichment' ? visibleCount : '—'})
          </button>
          <button
            onClick={() => setActiveTab('system')}
            aria-pressed={activeTab === 'system'}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'system'
                ? 'bg-sky-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            System Logs ({activeTab === 'system' ? visibleCount : '—'})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search log entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 bg-[#1a1a1a] border border-[#333333] text-white rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
          />
        </div>
      </div>

      {/* Log Console Body */}
      {busy && <p role="status" className="text-xs text-gray-400">Loading activity logs…</p>}
      {view?.error && <p role="alert" className="text-xs text-amber-300">{view.error}{view.rows.length ? ' Previously loaded entries remain visible.' : ''}</p>}
      <p className="text-[10px] text-gray-400">Up to 500 returned events, newest first. Full research evidence remains in Research.</p>
      <div className="bg-[#121212] rounded-xl border border-[#262626] p-3 font-mono text-xs max-h-[360px] overflow-y-auto custom-scrollbar space-y-2">
        {filteredLogs.length === 0 && !busy && !view?.error ? (
          <div className="text-gray-500 italic text-center py-8">
            {searchQuery ? `No ${activeTab} log entries match this search.` : `No ${activeTab} log entries available.`}
          </div>
        ) : activeTab === 'system' ? (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 text-[11px] leading-relaxed border-b border-[#1f1f1f] pb-1.5">
              <span className="text-gray-500 shrink-0">[{formatLogTime(log.timestamp)}]</span>
              <span
                className={`font-bold uppercase px-1 rounded text-[9px] shrink-0 ${
                  log.level === 'ERROR' || log.level === 'CRITICAL'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : log.level === 'WARNING'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-sky-950 text-sky-400 border border-sky-800'
                }`}
              >
                {log.level}
              </span>
              <span className="text-purple-400 font-semibold shrink-0">[{log.subsystem}]</span>
              <span className="text-gray-200 break-all">{log.message}</span>
            </div>
          ))
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 text-[11px] leading-relaxed border-b border-[#1f1f1f] pb-1.5">
              <span className="text-gray-500 shrink-0">[{formatLogTime(log.timestamp)}]</span>
              <span
                className={`font-bold uppercase px-1 rounded text-[9px] shrink-0 ${
                  log.level === 'SUCCESS'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : log.level === 'ERROR'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-sky-950 text-sky-400 border border-sky-800'
                }`}
              >
                {log.level}
              </span>
              <span className="text-amber-300 font-bold shrink-0">{log.company}</span>
              <span className="text-sky-400 shrink-0">[{log.subsystem}]</span>
              <span className="text-gray-300 break-all">{log.message || log.details || 'Enrichment event logged.'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
