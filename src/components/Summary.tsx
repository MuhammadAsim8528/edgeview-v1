import React from 'react';
import {
  Table,
  Building2,
  Ship,
  DollarSign,
  Tag,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Download,
} from 'lucide-react';
import { ParsedFile } from '../types';
import { GlobalExportPayload } from './GlobalExportModal';
import { formatCurrency, formatFullCurrency } from '../utils/formatters';
import { fetchAllFileRows } from '../utils/safeFetch';

interface SummaryProps {
  file: ParsedFile | null;
  onOpenExport?: (payload: GlobalExportPayload) => void;
}

export const Summary: React.FC<SummaryProps> = ({ file, onOpenExport }) => {
  if (!file) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-12 text-center text-[#9ca3af] shadow-xs">
        <p className="text-sm font-medium">No file selected to generate summary.</p>
      </div>
    );
  }

  const { summary } = file;

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-white">Dataset Summary: {file.name}</h2>
          <p className="text-xs text-[#9ca3af]">Comprehensive analytics overview for active file</p>
        </div>

        {onOpenExport && (
          <button
            onClick={async () => {
              let exportRecords = file.rows || [];
              if (exportRecords.length === 0) {
                try {
                  const { ok, data } = await fetchAllFileRows(file.id);
                  if (ok && data) {
                    exportRecords = data.rows;
                  }
                } catch (err) {
                  console.warn('Failed to load full dataset for summary export:', err);
                }
              }
              onOpenExport({
                dataset: 'summary',
                title: `Dataset Summary: ${file.name}`,
                records: exportRecords,
                filenamePrefix: `EdgeView_Summary_${file.name.replace(/\.[^/.]+$/, '')}`,
              });
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-[#10b981] hover:bg-[#0ea5e9] text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Export Summary Data</span>
          </button>
        )}
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rows Card */}
        <div className="bg-[#1a1a1a] border border-[#262626] p-5 rounded-xl shadow-xs">
          <span className="text-[10px] text-[#9ca3af] uppercase font-bold tracking-widest block">
            Total Records
          </span>
          <div className="text-3xl font-light mt-1 tracking-tight text-[#ffffff] font-mono">
            {summary.total_rows.toLocaleString()}
          </div>
          <span className="text-xs text-[#9ca3af] mt-1 block font-sans">
            Parsed records in file
          </span>
        </div>

        {/* Exporters Count Card */}
        <div className="bg-[#1a1a1a] border border-[#262626] p-5 rounded-xl shadow-xs">
          <span className="text-[10px] text-[#9ca3af] uppercase font-bold tracking-widest block">
            Exporters Found
          </span>
          <div className="text-3xl font-light mt-1 tracking-tight text-[#10b981] font-mono">
            {summary.exporters_count}
          </div>
          <span className="text-xs text-[#9ca3af] mt-1 block font-sans">
            Unique exporters identified
          </span>
        </div>

        {/* Importers Count Card */}
        <div className="bg-[#1a1a1a] border border-[#262626] p-5 rounded-xl shadow-xs">
          <span className="text-[10px] text-[#9ca3af] uppercase font-bold tracking-widest block">
            Importers Found
          </span>
          <div className="text-3xl font-light mt-1 tracking-tight text-[#10b981] font-mono">
            {summary.importers_count}
          </div>
          <span className="text-xs text-[#9ca3af] mt-1 block font-sans">
            Unique buyers/importers
          </span>
        </div>

        {/* Total Value Card - Dark Theme */}
        <div className="bg-[#1a1a1a] border border-[#262626] p-5 rounded-xl shadow-xs overflow-hidden">
          <span className="text-[10px] text-[#9ca3af] uppercase font-bold tracking-widest block">
            Total Value (USD)
          </span>
          <div
            className="text-3xl font-light mt-1 tracking-tight text-[#10b981] font-mono truncate"
            title={formatFullCurrency(summary.total_cost_usd)}
          >
            {formatCurrency(summary.total_cost_usd)}
          </div>
          <span className="text-xs text-[#9ca3af] mt-1 block font-sans">
            Aggregated trade value
          </span>
        </div>
      </div>

      {/* Detected Columns & Key Match Status */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-6 shadow-xs">
        <h3 className="text-sm font-bold text-[#ffffff] mb-4 flex items-center space-x-2">
          <Tag className="w-4 h-4 text-[#10b981]" />
          <span>Automatic Keyword Column Detection</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Exporter Column */}
          <div className="p-3.5 bg-[#262626] rounded-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-[#e5e7eb]">Exporter Column:</span>
              {summary.detected_exporter_col ? (
                <span className="inline-flex items-center space-x-1 text-[#10b981] font-medium bg-[#10b981]/10 px-2 py-0.5 rounded border border-[#10b981]/30">
                  <CheckCircle className="w-3 h-3 text-[#10b981]" />
                  <span>Detected</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[#9ca3af] bg-[#333333] px-2 py-0.5 rounded">
                  <HelpCircle className="w-3 h-3" />
                  <span>Not Found</span>
                </span>
              )}
            </div>
            <div className="font-mono text-[#ffffff] font-bold">
              {summary.detected_exporter_col || 'N/A'}
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1">
              Keywords: exporter, export, seller, supplier, vendor, shipper
            </p>
          </div>

          {/* Importer Column */}
          <div className="p-3.5 bg-[#262626] rounded-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-[#e5e7eb]">Importer Column:</span>
              {summary.detected_importer_col ? (
                <span className="inline-flex items-center space-x-1 text-[#10b981] font-medium bg-[#10b981]/10 px-2 py-0.5 rounded border border-[#10b981]/30">
                  <CheckCircle className="w-3 h-3 text-[#10b981]" />
                  <span>Detected</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[#9ca3af] bg-[#333333] px-2 py-0.5 rounded">
                  <HelpCircle className="w-3 h-3" />
                  <span>Not Found</span>
                </span>
              )}
            </div>
            <div className="font-mono text-[#ffffff] font-bold">
              {summary.detected_importer_col || 'N/A'}
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1">
              Keywords: importer, import, buyer, customer, consignee, receiver
            </p>
          </div>

          {/* Cost Column */}
          <div className="p-3.5 bg-[#262626] rounded-lg border border-[#333333]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-[#e5e7eb]">Total Value Column:</span>
              {summary.detected_cost_col ? (
                <span className="inline-flex items-center space-x-1 text-[#10b981] font-medium bg-[#10b981]/10 px-2 py-0.5 rounded border border-[#10b981]/30">
                  <CheckCircle className="w-3 h-3 text-[#10b981]" />
                  <span>Detected</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[#9ca3af] bg-[#333333] px-2 py-0.5 rounded">
                  <HelpCircle className="w-3 h-3" />
                  <span>Not Found</span>
                </span>
              )}
            </div>
            <div className="font-mono text-[#ffffff] font-bold">
              {summary.detected_cost_col || 'N/A'}
            </div>
            <p className="text-[11px] text-[#9ca3af] mt-1">
              Keywords: total value, total cost, total fc, tot_fc, val_usd, total_cost_usd, usd, amount, value, total
            </p>
          </div>
        </div>
      </div>

      {/* Identified Exporters & Importers Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identified Exporters List */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-5 shadow-xs">
          <h4 className="text-xs font-bold text-[#e5e7eb] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#10b981]" />
              <span>Identified Exporters ({summary.exporters_list.length})</span>
            </span>
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {summary.exporters_list.length === 0 ? (
              <p className="text-xs text-[#9ca3af] italic">No exporter companies identified in file.</p>
            ) : (
              summary.exporters_list.map((exporter, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-[#262626] hover:bg-[#333333] rounded border border-[#333333] text-xs font-medium text-[#e5e7eb] flex items-center justify-between"
                >
                  <span>{exporter}</span>
                  <span className="text-[10px] text-[#10b981] font-semibold bg-[#10b981]/10 px-1.5 py-0.5 rounded border border-[#10b981]/30">
                    Exporter
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Identified Importers List */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-5 shadow-xs">
          <h4 className="text-xs font-bold text-[#e5e7eb] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Ship className="w-4 h-4 text-indigo-400" />
              <span>Identified Importers ({summary.importers_list.length})</span>
            </span>
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
            {summary.importers_list.length === 0 ? (
              <p className="text-xs text-[#9ca3af] italic">No importer companies identified in file.</p>
            ) : (
              summary.importers_list.map((importer, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-[#262626] hover:bg-[#333333] rounded border border-[#333333] text-xs font-medium text-[#e5e7eb] flex items-center justify-between"
                >
                  <span>{importer}</span>
                  <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-700/40">
                    Importer
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
