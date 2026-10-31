import React, { useState } from 'react';
import {
  FileCheck,
  Bot,
  Table as TableIcon,
  FileText,
  Calendar,
  User,
  Download,
  Plus,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { EdgeViewReport } from '../types';
import { GlobalExportPayload } from './GlobalExportModal';

interface ReportsProps {
  reports: EdgeViewReport[];
  onOpenExport?: (payload: GlobalExportPayload) => void;
}

export const Reports: React.FC<ReportsProps> = ({ reports, onOpenExport }) => {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    reports.length > 0 ? reports[0].id : null
  );

  const selectedReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Reports List */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] shadow-xs overflow-hidden flex flex-col">
        <div className="p-4 bg-[#262626] text-white border-b border-[#333333] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-[#10b981]" />
            <h3 className="text-sm font-bold text-white">EdgeView AI Reports</h3>
          </div>
          <span className="text-xs bg-[#10b981]/20 text-[#10b981] font-mono px-2 py-0.5 rounded border border-[#10b981]/40">
            {reports.length} Total
          </span>
        </div>

        <div className="divide-y divide-[#262626] overflow-y-auto max-h-[550px] custom-scrollbar">
          {reports.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#9ca3af] italic">
              No reports generated yet.
            </div>
          ) : (
            reports.map((report) => {
              const isSelected = selectedReport?.id === report.id;
              return (
                <div
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`p-3.5 cursor-pointer transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-[#262626] border-l-4 border-[#10b981]' : 'hover:bg-[#262626]/60'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-white truncate">
                      {report.report_type === 'table' ? (
                        <TableIcon className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate">{report.title}</span>
                    </div>
                    <div className="text-[11px] text-[#9ca3af] mt-1 flex items-center space-x-2 font-mono">
                      <span>{report.created_by}</span>
                      <span>•</span>
                      <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#10b981]' : 'text-[#9ca3af]'}`} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Selected Report Viewer */}
      <div className="lg:col-span-2 bg-[#1a1a1a] rounded-xl border border-[#262626] shadow-xs overflow-hidden flex flex-col">
        {!selectedReport ? (
          <div className="p-12 text-center text-[#9ca3af]">Select a report to view details</div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Report Title Header */}
            <div className="p-5 bg-[#262626] border-b border-[#333333] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded font-mono ${
                      selectedReport.report_type === 'table'
                        ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
                        : 'bg-blue-950/60 text-blue-400 border border-blue-800'
                    }`}
                  >
                    {selectedReport.report_type.toUpperCase()}
                  </span>
                  <h2 className="text-base font-bold text-white">{selectedReport.title}</h2>
                </div>
                <div className="flex items-center space-x-4 text-xs text-[#9ca3af] mt-1">
                  <span className="flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-[#9ca3af]" />
                    <span>{selectedReport.created_by}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-[#9ca3af]" />
                    <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
                  </span>
                  {selectedReport.source_file && (
                    <span className="font-mono text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded border border-[#10b981]/20">
                      Source: {selectedReport.source_file}
                    </span>
                  )}
                </div>
              </div>

              {onOpenExport && (
                <button
                  onClick={() => {
                    onOpenExport({
                      dataset: 'reports',
                      title: selectedReport.title,
                      records: [], sourceReportId: selectedReport.id,
                      recordCount: selectedReport.report_type === 'table' ? selectedReport.rows?.length ?? 0 : 1,
                      filenamePrefix: `EdgeView_Report_${selectedReport.title.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
                    });
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-white" />
                  <span>Export Report</span>
                </button>
              )}
            </div>

            {/* Report Content */}
            <div className="p-6 overflow-y-auto max-h-[500px] custom-scrollbar">
              {selectedReport.report_type === 'table' && selectedReport.rows ? (
                /* Tabular Report Display */
                <div className="overflow-x-auto border border-[#333333] rounded-lg">
                  <table className="w-full text-xs text-left text-[#e5e7eb]">
                    <thead className="bg-[#262626] text-[#e5e7eb] font-bold border-b border-[#333333] uppercase">
                      <tr>
                        {selectedReport.columns?.map((col) => (
                          <th key={col} className="px-3.5 py-2.5 border-r border-[#333333]">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262626]">
                      {selectedReport.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#262626]">
                          {selectedReport.columns?.map((col) => (
                            <td key={col} className="px-3.5 py-2 border-r border-[#262626]">
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Text / Document Report Display */
                <div className="p-5 bg-[#262626] border border-[#333333] rounded-lg text-xs font-mono text-[#e5e7eb] whitespace-pre-wrap leading-relaxed">
                  {selectedReport.content_text || 'No text content available in report.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
