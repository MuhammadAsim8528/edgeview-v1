import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Search } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';
import { SystemLogEntry, EnrichmentLogEntry } from '../types';

export const LogsViewerPanel: React.FC = () => {
  const formatLogTime = (value: unknown) => {
    const date = new Date(String(value || ''));
    return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString();
  };
  const [activeTab, setActiveTab] = useState<'system' | 'enrichment'>('enrichment');
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [enrichmentLogs, setEnrichmentLogs] = useState<EnrichmentLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 'system') {
        const { ok, data } = await safeFetchJson<SystemLogEntry[]>('/api/logs/system');
        if (ok && Array.isArray(data)) setSystemLogs(data);
      } else if (activeTab === 'enrichment') {
        const { ok, data } = await safeFetchJson<EnrichmentLogEntry[]>('/api/logs/enrichment');
        if (ok && Array.isArray(data)) setEnrichmentLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const getFilteredLogs = () => {
    const q = searchQuery.toLowerCase();
    if (activeTab === 'system') {
      return systemLogs.filter((l) => !q || l.message.toLowerCase().includes(q) || l.subsystem.toLowerCase().includes(q) || (l.details && l.details.toLowerCase().includes(q)));
    } else if (activeTab === 'enrichment') {
      return enrichmentLogs.filter((l) => !q || l.company_name.toLowerCase().includes(q) || l.message.toLowerCase().includes(q) || (l.details && l.details.toLowerCase().includes(q)));
    }
    return [];
  };

  const filteredLogs = getFilteredLogs();

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
            disabled={loading}
            className="p-1.5 rounded-lg bg-[#1a1a1a] border border-[#333333] text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[#333333] pb-2 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('enrichment')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'enrichment'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            Enrichment Logs ({enrichmentLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'system'
                ? 'bg-sky-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
            }`}
          >
            System Logs ({systemLogs.length})
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
      <div className="bg-[#121212] rounded-xl border border-[#262626] p-3 font-mono text-xs max-h-[360px] overflow-y-auto custom-scrollbar space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 italic text-center py-8">
            No {activeTab} log entries available.
          </div>
        ) : activeTab === 'system' ? (
          (filteredLogs as SystemLogEntry[]).map((log) => (
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
          (filteredLogs as EnrichmentLogEntry[]).map((log) => (
            <div key={log.id} className="flex items-start space-x-2 text-[11px] leading-relaxed border-b border-[#1f1f1f] pb-1.5">
              <span className="text-gray-500 shrink-0">[{formatLogTime(log.timestamp)}]</span>
              <span
                className={`font-bold uppercase px-1 rounded text-[9px] shrink-0 ${
                  log.status === 'SUCCESS'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : log.status === 'ERROR'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-sky-950 text-sky-400 border border-sky-800'
                }`}
              >
                {log.status}
              </span>
              <span className="text-amber-300 font-bold shrink-0">{log.company_name}</span>
              <span className="text-sky-400 shrink-0">[{log.step}]</span>
              <span className="text-gray-300 break-all">{log.message || log.details || 'Enrichment event logged.'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
