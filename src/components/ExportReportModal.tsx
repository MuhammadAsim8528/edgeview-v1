import React, { useState } from 'react';
import { processAndValidateExportResponse } from '../utils/exportValidator';
import { FileText, Download, CheckCircle, RefreshCw, X, FileSpreadsheet, Archive, Table2 } from 'lucide-react';
import { CompanyContact } from '../types';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: CompanyContact[];
  selectedIds: string[];
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  contacts,
  selectedIds,
}) => {
  const [format, setFormat] = useState<'docx' | 'pdf' | 'xlsx' | 'csv' | 'all'>('docx');
  const [reportType, setReportType] = useState<'importer' | 'exporter' | 'both' | 'international_importer'>('importer');
  const [scope, setScope] = useState<'selected' | 'all'>(selectedIds.length > 0 ? 'selected' : 'all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportCompleted, setExportCompleted] = useState<boolean>(false);

  if (!isOpen) return null;

  const targetContacts = scope === 'selected' && selectedIds.length > 0
    ? contacts.filter(c => selectedIds.includes(c.id))
    : contacts;

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportCompleted(false);
    setExportProgress(10);
    setExportStep('Preparing data directory...');

    try {
      await new Promise(r => setTimeout(r, 200));
      setExportProgress(35);
      setExportStep(`Processing ${targetContacts.length} company profiles...`);

      await new Promise(r => setTimeout(r, 200));
      setExportProgress(70);
      setExportStep(`Compiling professional ${format.toUpperCase()} report...`);

      const res = await fetch('/api/export/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_ids: targetContacts.map(c => c.id),
          format,
          report_type: reportType,
        }),
      });

      setExportProgress(90);
      setExportStep('Validating document payload...');

      const isZip = reportType === 'both' || format === 'all';
      const expectedFormatForValidator = isZip ? 'all' : format;

      const { blob, filename } = await processAndValidateExportResponse(res, expectedFormatForValidator);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `EdgeView_${reportType}_report.${isZip ? 'zip' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportStep('Export completed successfully! Download initiated.');
      setExportCompleted(true);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-hidden">
      <div 
        className="bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-xl border border-[#333333] flex flex-col overflow-hidden animate-in fade-in duration-200 my-auto"
        style={{ maxHeight: 'min(92vh, calc(100dvh - 1.5rem))' }}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#333333] flex items-center justify-between bg-[#262626] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-950 flex items-center justify-center border border-sky-800">
              <FileText className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Contact Directory Report</h3>
              <p className="text-[11px] text-[#9ca3af]">Normalized executive document generation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-[#9ca3af] hover:text-white p-1 rounded-md hover:bg-[#333333] transition-colors cursor-pointer"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {/* Export Scope */}
          <div>
            <label className="block text-xs font-semibold text-[#e5e7eb] mb-2">Export Scope:</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('selected')}
                disabled={selectedIds.length === 0 || isExporting}
                className={`p-2.5 sm:p-3 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                  scope === 'selected'
                    ? 'bg-sky-950/60 border-sky-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                } ${selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="text-xs font-bold block">Selected Companies</span>
                <span className="text-[11px] text-[#9ca3af] font-mono mt-1">
                  {selectedIds.length} company record{selectedIds.length === 1 ? '' : 's'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                disabled={isExporting}
                className={`p-2.5 sm:p-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'bg-sky-950/60 border-sky-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <span className="text-xs font-bold block">All Directory Contacts</span>
                <span className="text-[11px] text-[#9ca3af] font-mono mt-1">
                  {contacts.length} total company record{contacts.length === 1 ? '' : 's'}
                </span>
              </button>
            </div>
          </div>

          {/* Report Classification */}
          <div>
            <label className="block text-xs font-semibold text-[#e5e7eb] mb-2">What would you like to export?</label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setReportType('importer')}
                disabled={isExporting}
                className={`p-2.5 sm:p-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                  reportType === 'importer'
                    ? 'bg-sky-950/60 border-sky-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <span className="text-xs font-bold block">Importer Report</span>
                <span className="text-[9px] text-[#9ca3af] mt-1 line-clamp-2 leading-snug">
                  Buyer intelligence & imported relationships
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('exporter')}
                disabled={isExporting}
                className={`p-2.5 sm:p-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                  reportType === 'exporter'
                    ? 'bg-sky-950/60 border-sky-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <span className="text-xs font-bold block">Exporter Report</span>
                <span className="text-[9px] text-[#9ca3af] mt-1 line-clamp-2 leading-snug">
                  Supplier intelligence & trade relationships
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('both')}
                disabled={isExporting}
                className={`p-2.5 sm:p-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                  reportType === 'both'
                    ? 'bg-sky-950/60 border-sky-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <span className="text-xs font-bold block">Both</span>
                <span className="text-[9px] text-[#9ca3af] mt-1 line-clamp-2 leading-snug">
                  Both reports in high-fidelity ZIP archive
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('international_importer')}
                disabled={isExporting}
                className={`p-2.5 sm:p-3 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer sm:col-span-2 ${
                  reportType === 'international_importer'
                    ? 'bg-sky-950/60 border-sky-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <span className="text-xs font-bold block">International Importer Directory</span>
                <span className="text-[9px] text-[#9ca3af] mt-1 line-clamp-2 leading-snug">
                  Importers only, Pakistan excluded, countries A→Z
                </span>
              </button>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#e5e7eb] mb-2">Output Format:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat('docx')}
                disabled={isExporting}
                className={`p-2 rounded-lg border flex items-center space-x-2.5 transition-colors cursor-pointer ${
                  format === 'docx'
                    ? 'bg-[#10b981]/20 border-[#10b981] text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <FileText className="w-4.5 h-4.5 text-[#10b981] shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold block">DOCX</span>
                  <span className="text-[9px] text-[#9ca3af]">Word Document</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                disabled={isExporting}
                className={`p-2 rounded-lg border flex items-center space-x-2.5 transition-colors cursor-pointer ${
                  format === 'pdf'
                    ? 'bg-red-950/60 border-red-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4.5 h-4.5 text-red-400 shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold block">PDF</span>
                  <span className="text-[9px] text-[#9ca3af]">Portable Document</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                disabled={isExporting}
                className={`p-2 rounded-lg border flex items-center space-x-2.5 transition-colors cursor-pointer ${
                  format === 'xlsx'
                    ? 'bg-green-950/60 border-green-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <Table2 className="w-4.5 h-4.5 text-green-400 shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold block">XLSX</span>
                  <span className="text-[9px] text-[#9ca3af]">Excel Grid</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                disabled={isExporting}
                className={`p-2 rounded-lg border flex items-center space-x-2.5 transition-colors cursor-pointer ${
                  format === 'csv'
                    ? 'bg-amber-950/60 border-amber-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <Table2 className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold block">CSV</span>
                  <span className="text-[9px] text-[#9ca3af]">Comma Separated</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('all')}
                disabled={isExporting}
                className={`p-2 rounded-lg border flex items-center space-x-2.5 transition-colors cursor-pointer sm:col-span-2 ${
                  format === 'all'
                    ? 'bg-purple-950/60 border-purple-500 text-white'
                    : 'bg-[#262626] border-[#333333] text-[#9ca3af] hover:text-white'
                }`}
              >
                <Archive className="w-4.5 h-4.5 text-purple-400 shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold block">ALL FORMATS</span>
                  <span className="text-[9px] text-[#9ca3af]">Bundle all files into ZIP</span>
                </div>
              </button>
            </div>
          </div>

          {/* Progress Indicator */}
          {(isExporting || exportCompleted) && (
            <div className="p-3 bg-[#262626] border border-[#333333] rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white flex items-center space-x-1.5">
                  {isExporting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-[#10b981]" />
                  )}
                  <span>{exportStep}</span>
                </span>
                <span className="font-mono text-sky-400 font-bold">{exportProgress}%</span>
              </div>
              <div className="w-full bg-[#1a1a1a] h-2 rounded-full overflow-hidden border border-[#333]">
                <div
                  className="bg-sky-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer - Always Visible & Pinned */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#333333] bg-[#262626] flex items-center justify-between shrink-0 mt-auto">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-xs font-semibold text-[#e5e7eb] hover:bg-[#333] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartExport}
            disabled={isExporting || targetContacts.length === 0}
            className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Proceed / Export ({targetContacts.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
