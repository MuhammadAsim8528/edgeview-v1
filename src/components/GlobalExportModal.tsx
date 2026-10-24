import React, { useState } from 'react';
import { processAndValidateExportResponse } from '../utils/exportValidator';
import { buildExportRequest } from '../utils/exportRequest';
import {
  FileText,
  FileSpreadsheet,
  File,
  Archive,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Layers,
} from 'lucide-react';

export interface GlobalExportPayload {
  dataset: string; // e.g., 'files' | 'contacts' | 'outreach' | 'country' | 'reports' | 'stats' | 'summary'
  title: string;
  records: any[];
  columns?: { key: string; header: string }[];
  selectedRows?: any[];
  filters?: Record<string, any>;
  filenamePrefix?: string;
  sourceFileId?: string;
  recordCount?: number;
}

export type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'all';

interface GlobalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: GlobalExportPayload | null;
}

export const GlobalExportModal: React.FC<GlobalExportModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [reportType, setReportType] = useState<'importer' | 'exporter' | 'both' | 'international_importer'>('importer');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStep, setExportStep] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  if (!isOpen || !payload) return null;

  const totalRecords = payload.recordCount ?? payload.records.length;
  const selectedCount = payload.selectedRows ? payload.selectedRows.length : 0;
  const effectiveCount = selectedCount > 0 ? selectedCount : totalRecords;

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);
    setExportProgress(15);
    setExportStep('Preparing dataset and format specifications...');

    try {
      await new Promise((r) => setTimeout(r, 200));
      setExportProgress(40);
      setExportStep(`Processing ${effectiveCount} record${effectiveCount === 1 ? '' : 's'} for ${selectedFormat.toUpperCase()} export...`);

      const request = buildExportRequest(payload, selectedFormat, reportType);

      setExportProgress(65);
      setExportStep(
        selectedFormat === 'all'
          ? 'Generating all file formats & packaging ZIP archive...'
          : `Compiling ${selectedFormat.toUpperCase()} document payload...`
      );

      const response = await fetch(request.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.body),
      });

      setExportProgress(85);
      setExportStep('Validating & finalizing download payload...');

      const { blob, filename } = await processAndValidateExportResponse(response, selectedFormat);

      // Trigger automatic browser download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setExportProgress(100);
      setExportStep('Export completed successfully!');
      setExportSuccess(true);

      setTimeout(() => {
        setIsExporting(false);
        setExportSuccess(false);
        onClose();
      }, 800);
    } catch (err: any) {
      console.error('Export error:', err);
      setExportError(err?.message || 'Export failed. Please try again.');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    setExportError(null);
    setExportSuccess(false);
    onClose();
  };

  const formatOptions: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'pdf',
      label: 'PDF',
      icon: <File className="w-4 h-4 text-rose-400" />,
      desc: 'Formated document ready for printing & sharing',
    },
    {
      id: 'docx',
      label: 'DOCX',
      icon: <FileText className="w-4 h-4 text-blue-400" />,
      desc: 'Microsoft Word document report',
    },
    {
      id: 'xlsx',
      label: 'XLSX',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
      desc: 'Excel spreadsheet workbook with auto column widths',
    },
    {
      id: 'csv',
      label: 'CSV',
      icon: <Database className="w-4 h-4 text-amber-400" />,
      desc: 'Standard UTF-8 comma-separated spreadsheet data',
    },
    {
      id: 'all',
      label: 'All formats',
      icon: <Archive className="w-4 h-4 text-purple-400" />,
      desc: 'Package PDF, DOCX, XLSX & CSV into a ZIP archive',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fade-in overflow-hidden">
      <div 
        className="bg-[#1a1a1a] rounded-xl border border-[#333333] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden my-auto"
        style={{ maxHeight: 'min(92vh, calc(100dvh - 1.5rem))' }}
      >
        {/* Header */}
        <div className="px-4 py-3 sm:py-3.5 bg-[#262626] border-b border-[#333333] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Data</h3>
              <p className="text-[11px] text-[#9ca3af] font-mono truncate max-w-[220px]">
                {payload.title || 'Selected Dataset'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="text-[#9ca3af] hover:text-white transition-colors disabled:opacity-50 cursor-pointer p-1 rounded-md hover:bg-[#333333]"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs text-[#e5e7eb] overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Active Dataset Scope Box */}
          <div className="p-2.5 sm:p-3 bg-[#262626] rounded-lg border border-[#333333] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#10b981]" />
              <span className="font-semibold text-white">
                {selectedCount > 0 ? 'Selected Records:' : 'Total Records:'}
              </span>
            </div>
            <span className="font-mono font-bold text-xs sm:text-sm text-[#10b981] bg-[#10b981]/10 px-2.5 py-0.5 rounded border border-[#10b981]/30">
              {effectiveCount.toLocaleString()} {effectiveCount === 1 ? 'record' : 'records'}
            </span>
          </div>

          {/* Report Classification (Contacts Directory) */}
          {payload.dataset === 'contacts' && (
            <div>
              <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
                Report Type:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'importer', label: 'Importer', desc: 'Buyers & History' },
                    { id: 'exporter', label: 'Exporter', desc: 'Suppliers & History' },
                    { id: 'both', label: 'Both', desc: 'ZIP Package' },
                    { id: 'international_importer', label: 'International Importers', desc: 'Excl. Pakistan, A→Z' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => !isExporting && setReportType(opt.id)}
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      reportType === opt.id
                        ? 'bg-[#262626] border-sky-500 text-white ring-1 ring-sky-500/50'
                        : 'bg-[#1a1a1a] border-[#333333] text-[#9ca3af] hover:bg-[#262626]/60 hover:text-[#e5e7eb]'
                    } ${isExporting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-xs font-bold block">{opt.label}</span>
                    <span className="text-[10px] text-[#9ca3af] mt-0.5 block leading-tight truncate">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Format Radio Selection Options */}
          <div>
            <label className="block text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-1.5">
              Select Export Format:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {formatOptions.map((opt) => {
                const isSelected = selectedFormat === opt.id;
                const isFullWidth = opt.id === 'all';
                return (
                  <label
                    key={opt.id}
                    onClick={() => !isExporting && setSelectedFormat(opt.id)}
                    className={`flex items-start space-x-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isFullWidth ? 'sm:col-span-2' : ''
                    } ${
                      isSelected
                        ? 'bg-[#262626] border-sky-500 text-white ring-1 ring-sky-500/50'
                        : 'bg-[#1a1a1a] border-[#333333] text-[#9ca3af] hover:bg-[#262626]/60 hover:text-[#e5e7eb]'
                    } ${isExporting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="export_format"
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => setSelectedFormat(opt.id)}
                      disabled={isExporting}
                      className="mt-0.5 text-sky-500 focus:ring-sky-500 accent-sky-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        {opt.icon}
                        <span>{opt.label}</span>
                      </div>
                      <p className="text-[10px] text-[#9ca3af] mt-0.5 leading-tight">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Progress & Error States */}
          {exportError && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Export Failed</span>
                <span>{exportError}</span>
              </div>
            </div>
          )}

          {(isExporting || exportSuccess) && (
            <div className="p-3 bg-[#262626] rounded-lg border border-[#333333] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center space-x-2">
                  {exportSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                  )}
                  <span>{exportStep}</span>
                </span>
                <span className="font-mono text-sky-400 font-bold">{exportProgress}%</span>
              </div>

              <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden border border-[#333333]">
                <div
                  style={{ width: `${exportProgress}%` }}
                  className={`h-full transition-all duration-300 ${
                    exportSuccess ? 'bg-[#10b981]' : 'bg-sky-500'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons - Always Visible & Pinned to Modal Bottom */}
        <div className="px-4 py-3 bg-[#262626] border-t border-[#333333] flex items-center justify-between shrink-0 mt-auto">
          <button
            type="button"
            onClick={handleClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#333333] border border-[#333333] text-[#9ca3af] hover:text-white font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting || effectiveCount === 0}
            className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Proceed / Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
