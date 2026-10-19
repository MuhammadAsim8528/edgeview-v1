import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { ActivityLogEntry } from '../types';
import { safeFetchJson } from '../utils/safeFetch';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { ok, data } = await safeFetchJson<ActivityLogEntry[]>('/api/enrich/activity-log');
      if (ok && Array.isArray(data)) {
        setLogs(data);
      }
    } catch (e) {
      console.error('Failed to load activity log', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-hidden">
      <div 
        className="bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-2xl border border-[#333333] flex flex-col overflow-hidden my-auto"
        style={{ maxHeight: 'min(92vh, calc(100dvh - 1.5rem))' }}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center border border-indigo-800">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">System Activity & Operations Log</h3>
              <p className="text-[11px] text-[#9ca3af]">Real-time operational tracing of enrichment tasks</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="p-1.5 rounded-md text-[#9ca3af] hover:text-white hover:bg-[#333333] transition-colors"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#9ca3af] hover:text-white hover:bg-[#333333] transition-colors"
              aria-label="Close activity log"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar space-y-2">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9ca3af] italic">
              No recent activity recorded yet. Run a company search or batch enrichment task to generate logs.
            </div>
          ) : (
            logs.map((log) => {
              const typeIcon =
                log.type === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                ) : log.type === 'warn' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : log.type === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                );

              return (
                <div
                  key={log.id}
                  className="p-3 bg-[#262626] border border-[#333333] rounded-lg flex items-start space-x-3 text-xs"
                >
                  {typeIcon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">
                        {log.company_name ? `[${log.company_name}]` : 'System Event'}
                      </span>
                      <span className="text-[10px] text-[#9ca3af] font-mono shrink-0">{log.timestamp}</span>
                    </div>
                    <p className="text-[#e5e7eb] mt-0.5 leading-relaxed font-mono text-[11px]">{log.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#333333] bg-[#262626] flex items-center justify-between text-xs text-[#9ca3af]">
          <span>Log buffer: {logs.length} events</span>
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
