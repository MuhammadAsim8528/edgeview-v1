import React, { useState, useEffect, useMemo, useRef } from 'react';
import { processAndValidateExportResponse } from '../utils/exportValidator';
import { safeFetchJson } from '../utils/safeFetch';
import {
  TrendingUp,
  Globe,
  Building2,
  Package,
  Calendar,
  Download,
  Filter,
  Search,
  ArrowUpDown,
  CheckCircle2,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  FileText,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Ship,
  Info,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  ParsedFile,
  GlobalStatsSummary,
  StatsCountryItem,
  StatsImporterItem,
  ImporterStatsSummary,
  ProductRepetitionItem,
  ExporterDistributionItem,
  ShipmentDetailItem,
  HistoryFileItem,
} from '../types';
import { GlobalExportPayload } from './GlobalExportModal';
import { formatNumber, formatCurrency, formatFullCurrency } from '../utils/formatters';

interface StatsTabProps {
  files: ParsedFile[];
  selectedFileId: string | null;
  onSelectFile?: (fileId: string) => void;
  onOpenExport?: (payload: GlobalExportPayload) => void;
}

type PeriodMode = 'full' | 'yearly' | 'monthly' | 'custom';
type SortField = 'date' | 'invoice_no' | 'product' | 'quantity' | 'total_value' | 'exporter';

export const StatsTab: React.FC<StatsTabProps> = ({ files, selectedFileId, onSelectFile, onOpenExport }) => {
  // Global Metrics State
  const [globalStats, setGlobalStats] = useState<GlobalStatsSummary | null>(null);
  const [countries, setCountries] = useState<StatsCountryItem[]>([]);
  const [importers, setImporters] = useState<StatsImporterItem[]>([]);

  // Filter Selection State
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedImporter, setSelectedImporter] = useState<string>('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('full');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Importer Stats Result State
  const [importerSummary, setImporterSummary] = useState<ImporterStatsSummary | null>(null);
  const [products, setProducts] = useState<ProductRepetitionItem[]>([]);
  const [exporters, setExporters] = useState<ExporterDistributionItem[]>([]);
  const [shipments, setShipments] = useState<ShipmentDetailItem[]>([]);

  // UI & Filter Search States
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const statsRequest = useRef<AbortController | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [exporterSearch, setExporterSearch] = useState<string>('');
  const [shipmentSearch, setShipmentSearch] = useState<string>('');
  const [selectedExporterFilter, setSelectedExporterFilter] = useState<string>('');

  // Detailed Shipments Table Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // History Files & Deletion State
  const [historyFiles, setHistoryFiles] = useState<HistoryFileItem[]>([]);
  const [isLoadingHistoryFiles, setIsLoadingHistoryFiles] = useState<boolean>(false);
  const [historyFileSearch, setHistoryFileSearch] = useState<string>('');
  const [historyFileSortField, setHistoryFileSortField] = useState<'file_name' | 'uploaded_at' | 'row_count' | 'total_value'>('uploaded_at');
  const [historyFileSortDir, setHistoryFileSortDir] = useState<'asc' | 'desc'>('desc');

  // Delete Modal State
  const [fileToDelete, setFileToDelete] = useState<HistoryFileItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeletingFile, setIsDeletingFile] = useState<boolean>(false);
  const [deleteNotice, setDeleteNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Raw Record Detail Modal
  const [selectedRawRecord, setSelectedRawRecord] = useState<Record<string, any> | null>(null);

  // Fetch History Files list from backend
  const fetchHistoryFiles = async () => {
    setIsLoadingHistoryFiles(true);
    try {
      const { ok, data } = await safeFetchJson<any>('/api/stats/history-files');
      if (ok && data && data.success && Array.isArray(data.data)) {
        setHistoryFiles(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch history files list:', err);
    } finally {
      setIsLoadingHistoryFiles(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete || deleteConfirmText !== 'delete') return;
    setIsDeletingFile(true);
    try {
      const { ok, data, error } = await safeFetchJson<any>(`/api/stats/history-files/${fileToDelete.id}`, {
        method: 'DELETE',
      });
      if (ok && data && data.success) {
        setDeleteNotice({ type: 'success', text: data.message || `File "${fileToDelete.file_name}" permanently deleted.` });
        setFileToDelete(null);
        setDeleteConfirmText('');
        await Promise.all([fetchHistoryFiles(), fetchGlobalData()]);
      } else {
        setDeleteNotice({ type: 'error', text: data?.error || error || 'Failed to delete file.' });
      }
    } catch (err: any) {
      setDeleteNotice({ type: 'error', text: err?.message || 'Error occurred during file deletion.' });
    } finally {
      setIsDeletingFile(false);
    }
  };

  const filteredHistoryFiles = useMemo(() => {
    return historyFiles
      .filter((f) => {
        if (!f) return false;
        // Strictly exclude test data records
        if (f.source === 'test') return false;
        const nameLower = (f.file_name || '').toLowerCase().trim();
        if (
          nameLower.includes('sample') ||
          nameLower.includes('test') ||
          nameLower.includes('demo') ||
          nameLower.includes('mock') ||
          nameLower.includes('pharma_imports_2026') ||
          nameLower.includes('shipments_q2') ||
          nameLower.includes('suppliers_master') ||
          nameLower.includes('trade_manifest') ||
          nameLower.includes('compliance_audit_report')
        ) {
          return false;
        }

        if (historyFileSearch.trim()) {
          return f.file_name.toLowerCase().includes(historyFileSearch.toLowerCase().trim());
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[historyFileSortField];
        let valB: any = b[historyFileSortField];

        if (historyFileSortField === 'uploaded_at') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }

        if (valA < valB) return historyFileSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return historyFileSortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [historyFiles, historyFileSearch, historyFileSortField, historyFileSortDir]);

  // 1. Fetch Global Summary & Country List
  useEffect(() => {
    fetchGlobalData();
    fetchHistoryFiles();
  }, [selectedFileId, files]);

  const fetchGlobalData = async () => {
    try {
      const fileParam = selectedFileId ? `?file_id=${selectedFileId}` : '';
      const [sumRes, countRes] = await Promise.all([
        safeFetchJson<GlobalStatsSummary>(`/api/stats/summary${fileParam}`),
        safeFetchJson<StatsCountryItem[]>(`/api/stats/countries${fileParam}`),
      ]);

      if (sumRes.ok && sumRes.data) {
        setGlobalStats(sumRes.data);
      }

      if (countRes.ok && countRes.data) {
        setCountries(countRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch global stats:', err);
    }
  };

  // 2. Fetch Importers when Country changes
  useEffect(() => {
    fetchImportersForCountry(selectedCountry);
  }, [selectedCountry, selectedFileId]);

  const fetchImportersForCountry = async (cName: string, preserveSelectedImporter?: string) => {
    try {
      const fileParam = selectedFileId ? `?file_id=${selectedFileId}` : '';
      const encodedCountry = encodeURIComponent(cName || 'ALL');
      const { ok, data } = await safeFetchJson<StatsImporterItem[]>(`/api/stats/countries/${encodedCountry}/importers${fileParam}`);

      if (ok && Array.isArray(data)) {
        const impList = data;
        setImporters(impList);

        const targetImp = preserveSelectedImporter !== undefined ? preserveSelectedImporter : selectedImporter;
        if (targetImp && impList.some((i) => i.importer.toLowerCase() === targetImp.toLowerCase())) {
          setSelectedImporter(targetImp);
        } else if (impList.length > 0) {
          setSelectedImporter(impList[0].importer);
        } else {
          setSelectedImporter('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch importers:', err);
    }
  };

  const handleCountryChange = (cName: string) => {
    setSelectedCountry(cName);
    fetchImportersForCountry(cName, '');
  };

  // 3. Reload the complete selected scope, including the same importer in another country.
  useEffect(() => {
    if (selectedImporter) {
      loadImporterStats();
    } else {
      setImporterSummary(null);
      setProducts([]); setExporters([]); setShipments([]);
      setStatsError(null); setIsLoadingStats(false);
    }
    return () => { statsRequest.current?.abort(); statsRequest.current = null; };
  }, [selectedImporter, selectedCountry, selectedFileId]);

  const loadImporterStats = async () => {
    if (!selectedImporter) return;
    statsRequest.current?.abort();
    const controller = new AbortController();
    statsRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setStatsError(null);
    setIsLoadingStats(true);
    setCurrentPage(1);
    setSelectedExporterFilter('');

    try {
      const fileParam = selectedFileId ? `&file_id=${selectedFileId}` : '';
      const cParam = selectedCountry !== 'ALL' ? `&country=${encodeURIComponent(selectedCountry)}` : '';
      const startParam = startDate ? `&start=${encodeURIComponent(startDate)}` : '';
      const endParam = endDate ? `&end=${encodeURIComponent(endDate)}` : '';

      const queryStr = `?${fileParam}${cParam}${startParam}${endParam}`.replace('?&', '?');

      const [sumRes, prodRes, expRes, shipRes] = await Promise.all([
        safeFetchJson<ImporterStatsSummary>(`/api/stats/importers/${encodeURIComponent(selectedImporter)}/summary${queryStr}`, { signal: controller.signal }),
        safeFetchJson<any[]>(`/api/stats/importers/${encodeURIComponent(selectedImporter)}/products${queryStr}`, { signal: controller.signal }),
        safeFetchJson<any[]>(`/api/stats/importers/${encodeURIComponent(selectedImporter)}/exporters${queryStr}`, { signal: controller.signal }),
        safeFetchJson<any[]>(`/api/stats/importers/${encodeURIComponent(selectedImporter)}/shipments${queryStr}`, { signal: controller.signal }),
      ]);

      if (statsRequest.current !== controller) return;
      if (controller.signal.aborted || !sumRes.ok || !sumRes.data || !prodRes.ok || !Array.isArray(prodRes.data)
        || !expRes.ok || !Array.isArray(expRes.data) || !shipRes.ok || !Array.isArray(shipRes.data)) {
        setStatsError(controller.signal.aborted ? 'Analytics loading timed out. Retry when EdgeView is available.' : 'Could not load this analytics scope. Retry before using these results.');
        return;
      }

      if (sumRes.ok && sumRes.data) {
        const sumData = sumRes.data;
        setImporterSummary(sumData);

        // Auto-Update Filters on Selection
        if (
          sumData.country &&
          sumData.country !== 'Unknown' &&
          sumData.country !== 'All Countries' &&
          sumData.country.toLowerCase() !== selectedCountry.toLowerCase()
        ) {
          setSelectedCountry(sumData.country);
          fetchImportersForCountry(sumData.country, selectedImporter);
        }
      }

      if (prodRes.ok && prodRes.data) {
        setProducts(prodRes.data);
      }
      if (expRes.ok && expRes.data) {
        setExporters(expRes.data);
      }
      if (shipRes.ok && shipRes.data) {
        setShipments(shipRes.data);
      }
    } catch (err) {
      if (statsRequest.current === controller) setStatsError('Could not load this analytics scope. Retry before using these results.');
    } finally {
      clearTimeout(timeout);
      if (statsRequest.current === controller) setIsLoadingStats(false);
    }
  };

  // Select Importer with Auto Country Lookup & Sync
  const handleSelectImporter = async (impName: string) => {
    if (!impName) {
      setSelectedImporter('');
      return;
    }
    setSelectedImporter(impName);

    try {
      const fileParam = selectedFileId ? `file_id=${selectedFileId}` : '';
      const sumRes = await safeFetchJson<ImporterStatsSummary>(`/api/stats/importers/${encodeURIComponent(impName)}/summary?${fileParam}`);
      if (sumRes.ok && sumRes.data) {
        const sumData = sumRes.data;
        const extractedCountry = sumData.country;

        if (extractedCountry && extractedCountry !== 'Unknown' && extractedCountry !== 'All Countries') {
          // 1. Extract country & 2. Update country filter dropdown
          setSelectedCountry(extractedCountry);

          // 3 & 4. Fetch importers for country and update company filter dropdown
          const impRes = await safeFetchJson<StatsImporterItem[]>(`/api/stats/countries/${encodeURIComponent(extractedCountry)}/importers?${fileParam}`);
          if (impRes.ok && impRes.data) {
            setImporters(impRes.data);
          }

          // 5. Highlight the selected importer
          setSelectedImporter(impName);
        }
      }
    } catch (err) {
      console.error('Failed to auto-update filters for importer:', err);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedImporter) return;

    if (onOpenExport) {
      const cleanName = selectedImporter.replace(/[^a-zA-Z0-9_-]/g, '_');
      onOpenExport({
        dataset: 'stats',
        title: `Importer Intelligence: ${selectedImporter}`,
        records: shipments,
        filters: {
          country: selectedCountry,
          importer: selectedImporter,
          startDate,
          endDate,
        },
        filenamePrefix: `EdgeView_Stats_${cleanName}`,
      });
      return;
    }

    setIsExporting(true);
    try {
      const fileParam = selectedFileId ? `&file_id=${selectedFileId}` : '';
      const cParam = selectedCountry !== 'ALL' ? `&country=${encodeURIComponent(selectedCountry)}` : '';
      const startParam = startDate ? `&start=${encodeURIComponent(startDate)}` : '';
      const endParam = endDate ? `&end=${encodeURIComponent(endDate)}` : '';
      const queryStr = `?${fileParam}${cParam}${startParam}${endParam}`.replace('?&', '?');

      const url = `/api/stats/importers/${encodeURIComponent(selectedImporter)}/export${queryStr}`;
      const response = await fetch(url);
      const { blob, filename } = await processAndValidateExportResponse(response, 'csv');
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanName = selectedImporter.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = filename || `Pharma_Stats_${cleanName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export CSV report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Products Table
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const term = productSearch.toLowerCase();
    return products.filter((p) => p.product.toLowerCase().includes(term));
  }, [products, productSearch]);

  // Filtered Exporters Table
  const filteredExporters = useMemo(() => {
    if (!exporterSearch.trim()) return exporters;
    const term = exporterSearch.toLowerCase();
    return exporters.filter((e) => e.exporter.toLowerCase().includes(term));
  }, [exporters, exporterSearch]);

  // Filtered & Sorted Detailed Shipments
  const filteredShipments = useMemo(() => {
    let list = shipments;

    if (selectedExporterFilter) {
      list = list.filter((s) => s.exporter.toLowerCase() === selectedExporterFilter.toLowerCase());
    }

    if (shipmentSearch.trim()) {
      const term = shipmentSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.invoice_no.toLowerCase().includes(term) ||
          s.product.toLowerCase().includes(term) ||
          s.exporter.toLowerCase().includes(term) ||
          s.country.toLowerCase().includes(term) ||
          s.date.toLowerCase().includes(term)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'total_value' || sortField === 'quantity') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [shipments, shipmentSearch, selectedExporterFilter, sortField, sortDirection]);

  // Pagination for Detailed Shipments
  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / pageSize));
  const paginatedShipments = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredShipments.slice(startIdx, startIdx + pageSize);
  }, [filteredShipments, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Color bar styling palette
  const BAR_COLORS = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-teal-500',
    'bg-indigo-500',
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-white p-4 sm:p-6 space-y-6 custom-scrollbar">
      {/* 1. Header & Global KPI Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-[#10b981]" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">History / Stats Dashboard</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Persisted trade activity analytics, country-to-importer drill-down, and invoice shipment details.
          </p>
        </div>

        <button
          onClick={fetchGlobalData}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 hover:text-white text-xs font-medium border border-[#333333] transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#10b981]" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Top Summary KPI Cards (Issue 1: Number Overflow fixed) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex items-center space-x-4 shadow-sm min-w-0">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 shrink-0">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-xs text-gray-400 font-medium truncate">Total Records</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-0.5 truncate text-ellipsis">
              {globalStats ? globalStats.total_records.toLocaleString() : '—'}
            </div>
          </div>
        </div>

        {/* Total Export Value */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex items-center space-x-4 shadow-sm min-w-0">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[#10b981] shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-xs text-gray-400 font-medium truncate">Total Value (USD)</div>
            <div
              className="text-xl sm:text-2xl font-extrabold text-[#10b981] font-mono mt-0.5 truncate text-ellipsis"
              title={globalStats ? formatFullCurrency(globalStats.total_value) : ''}
            >
              {globalStats ? formatCurrency(globalStats.total_value) : '—'}
            </div>
            {globalStats && globalStats.total_value >= 1000000 && (
              <div className="text-[10px] text-gray-400 font-mono truncate">
                {formatFullCurrency(globalStats.total_value)}
              </div>
            )}
          </div>
        </div>

        {/* Total Countries */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex items-center space-x-4 shadow-sm min-w-0">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 shrink-0">
            <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-xs text-gray-400 font-medium truncate">Total Countries</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-0.5 truncate text-ellipsis">
              {globalStats ? globalStats.total_countries : '—'}
            </div>
          </div>
        </div>

        {/* Total Importers / Companies */}
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex items-center space-x-4 shadow-sm min-w-0">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 shrink-0">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="text-xs text-gray-400 font-medium truncate">Total Importers</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-0.5 truncate text-ellipsis">
              {globalStats ? globalStats.total_companies : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 1.5 Uploaded Files History Section */}
      <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-[#10b981]" />
              <span>Uploaded Files</span>
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Files uploaded to EdgeView and saved permanently to the trade history database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search file name..."
                value={historyFileSearch}
                onChange={(e) => setHistoryFileSearch(e.target.value)}
                className="bg-[#242424] border border-[#333333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10b981]"
              />
            </div>
            <button
              onClick={fetchHistoryFiles}
              className="p-1.5 bg-[#242424] hover:bg-[#333333] border border-[#333333] rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Refresh Files List"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingHistoryFiles ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {deleteNotice && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
              deleteNotice.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-[#10b981]'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            <span>{deleteNotice.text}</span>
            <button onClick={() => setDeleteNotice(null)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar border border-[#262626] rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#242424] text-gray-400 font-semibold uppercase text-[10px] border-b border-[#333333]">
              <tr>
                <th
                  onClick={() => {
                    if (historyFileSortField === 'file_name') {
                      setHistoryFileSortDir(historyFileSortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      setHistoryFileSortField('file_name');
                      setHistoryFileSortDir('asc');
                    }
                  }}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>File Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (historyFileSortField === 'uploaded_at') {
                      setHistoryFileSortDir(historyFileSortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      setHistoryFileSortField('uploaded_at');
                      setHistoryFileSortDir('desc');
                    }
                  }}
                  className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (historyFileSortField === 'row_count') {
                      setHistoryFileSortDir(historyFileSortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      setHistoryFileSortField('row_count');
                      setHistoryFileSortDir('desc');
                    }
                  }}
                  className="py-2.5 px-4 text-center cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Rows</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (historyFileSortField === 'total_value') {
                      setHistoryFileSortDir(historyFileSortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      setHistoryFileSortField('total_value');
                      setHistoryFileSortDir('desc');
                    }
                  }}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total Value (USD)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-4 text-center">Countries</th>
                <th className="py-2.5 px-4 text-center">Importers</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {filteredHistoryFiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                    {isLoadingHistoryFiles
                      ? 'Loading history files...'
                      : 'No saved uploaded files found in history database.'}
                  </td>
                </tr>
              ) : (
                filteredHistoryFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-[#222222] transition-colors">
                    <td className="py-2.5 px-4 font-medium text-white max-w-xs truncate" title={file.file_name}>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-[#10b981] shrink-0" />
                        <span className="truncate">{file.file_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-gray-400 text-[11px]">
                      {new Date(file.uploaded_at).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-gray-300">
                      <span className="px-2 py-0.5 bg-[#262626] rounded text-xs font-semibold">
                        {file.row_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#10b981] font-bold" title={formatFullCurrency(file.total_value)}>
                      {formatCurrency(file.total_value)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-amber-400 font-semibold">
                      {file.unique_countries || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-purple-400 font-semibold">
                      {file.unique_importers || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {onSelectFile && (
                          <button
                            onClick={() => onSelectFile(file.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-[#10b981] border border-emerald-500/20 rounded-md text-xs font-medium transition-colors"
                            title="Load dataset into File Viewer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setFileToDelete(file);
                            setDeleteConfirmText('');
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md text-xs font-medium transition-colors"
                          title="Permanently delete file and all its records"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Filters Bar (Issue 2: Auto-Update Filters on Selection) */}
      <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-[#10b981]" />
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider">Analytics Filter & Auto-Sync</h2>
          </div>
          {importerSummary && !isLoadingStats && !statsError && (
            <span className="text-[11px] text-[#10b981] font-mono bg-[#10b981]/10 border border-[#10b981]/20 px-2.5 py-0.5 rounded-full">
              Synced to: {importerSummary.country}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Select Country */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center space-x-1">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Select Country</span>
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full bg-[#242424] border border-[#333333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10b981] transition-colors"
            >
              <option value="ALL">All Countries ({countries.length})</option>
              {countries.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.country} ({c.importers_count} importers)
                </option>
              ))}
            </select>
          </div>

          {/* Select Company (Importer) */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Select Company (Importer)</span>
            </label>
            <select
              value={selectedImporter}
              onChange={(e) => handleSelectImporter(e.target.value)}
              className="w-full bg-[#242424] border border-[#333333] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10b981] transition-colors"
            >
              {importers.length === 0 ? (
                <option value="">No importers found</option>
              ) : (
                importers.map((imp) => (
                  <option key={imp.importer} value={imp.importer}>
                    {imp.importer} ({formatCurrency(imp.total_value)})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Time Period Mode Pills */}
          <div className="col-span-1 lg:col-span-2">
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Time Period Filter</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['full', 'yearly', 'monthly', 'custom'] as PeriodMode[]).map((mode) => {
                const labels: Record<PeriodMode, string> = {
                  full: 'Full History',
                  yearly: 'Yearly',
                  monthly: 'Monthly',
                  custom: 'Custom Range',
                };
                const isActive = periodMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setPeriodMode(mode);
                      if (mode === 'full') {
                        setStartDate('');
                        setEndDate('');
                      } else if (mode === 'yearly') {
                        const curYear = new Date().getFullYear();
                        setStartDate(`${curYear}-01-01`);
                        setEndDate(`${curYear}-12-31`);
                      } else if (mode === 'monthly') {
                        const now = new Date();
                        const y = now.getFullYear();
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        setStartDate(`${y}-${m}-01`);
                        setEndDate(`${y}-${m}-31`);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#10b981] text-white shadow-xs font-semibold'
                        : 'bg-[#242424] text-gray-400 hover:text-white hover:bg-[#333333]'
                    }`}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Date Inputs when Custom/Yearly/Monthly */}
        {periodMode !== 'full' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#262626]">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#242424] border border-[#333333] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#242424] border border-[#333333] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadImporterStats}
                className="w-full bg-[#10b981] hover:bg-[#0d9668] text-white text-xs font-semibold py-1.5 px-4 rounded-md transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>Apply Range</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Dashboard Stats for Selected Importer */}
      {selectedImporter && isLoadingStats ? (
        <p role="status" className="p-4 text-sm text-gray-400">Loading selected analytics scope…</p>
      ) : selectedImporter && statsError ? (
        <div role="alert" className="p-4 rounded-lg border border-rose-800 text-rose-200">
          <p>{statsError}</p>
          <button onClick={() => { void loadImporterStats(); }} className="mt-2 px-3 py-1 rounded bg-[#262626] border border-[#444]">Retry analytics</button>
        </div>
      ) : selectedImporter ? (
        <div className="space-y-6">
          {/* Header & Importer Summary Row */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-[#10b981]" />
                  <span>Stats for: {importerSummary?.importer || selectedImporter}</span>
                </h2>
                <div className="text-xs text-gray-400 mt-0.5 flex items-center space-x-2">
                  <span className="text-[#10b981] font-semibold">{importerSummary?.country || selectedCountry}</span>
                  <span>•</span>
                  <span>
                    Range: {startDate || endDate ? `${startDate || 'Beginning'} to ${endDate || 'Present'}` : 'Full History'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#0d9668] text-white text-xs font-semibold shadow-xs transition-colors shrink-0 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Exporting...' : 'Export Full History & Invoices'}</span>
              </button>
            </div>

            {/* Importer KPI Row (With Compact + Tooltip Overflow Handling) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="bg-[#242424] p-3.5 rounded-lg border border-[#333333] min-w-0">
                <div className="text-[11px] text-gray-400 uppercase font-semibold truncate">Total Export Value</div>
                <div
                  className="text-lg sm:text-xl font-bold text-[#10b981] font-mono mt-1 truncate text-ellipsis"
                  title={formatFullCurrency(importerSummary?.total_export_value || 0)}
                >
                  {formatCurrency(importerSummary?.total_export_value || 0)}
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                  {formatFullCurrency(importerSummary?.total_export_value || 0)}
                </div>
              </div>

              <div className="bg-[#242424] p-3.5 rounded-lg border border-[#333333] min-w-0">
                <div className="text-[11px] text-gray-400 uppercase font-semibold truncate">Total Exporters</div>
                <div className="text-lg sm:text-xl font-bold text-white font-mono mt-1 truncate">
                  {importerSummary?.total_exporters || 0}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">Unique suppliers</div>
              </div>

              <div className="bg-[#242424] p-3.5 rounded-lg border border-[#333333] min-w-0">
                <div className="text-[11px] text-gray-400 uppercase font-semibold truncate">Total Shipments</div>
                <div className="text-lg sm:text-xl font-bold text-white font-mono mt-1 truncate">
                  {importerSummary?.total_shipments || 0}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">Invoice bills recorded</div>
              </div>
            </div>
          </div>

          {/* 4. Visual Share Bars (Products & Exporters Top Share) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products Distribution */}
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Package className="w-4 h-4 text-[#10b981]" />
                  <span>Top Product Breakdown (% Value)</span>
                </h3>
                <span className="text-xs text-gray-400 font-mono">{products.length} Products</span>
              </div>

              {products.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 italic">No products recorded.</div>
              ) : (
                <div className="space-y-3">
                  {products.slice(0, 5).map((p, idx) => (
                    <div key={p.product} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-200 truncate max-w-[200px]" title={p.product}>
                          {p.product}
                        </span>
                        <div className="flex items-center space-x-2 font-mono text-[11px]">
                          <span className="text-gray-400" title={formatFullCurrency(p.total_value)}>
                            {formatCurrency(p.total_value)}
                          </span>
                          <span className="text-[#10b981] font-bold">{p.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#242424] h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${BAR_COLORS[idx % BAR_COLORS.length]} transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.max(p.percentage, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Exporters Share */}
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Exporters Share (% Value)</span>
                </h3>
                <span className="text-xs text-gray-400 font-mono">{exporters.length} Exporters</span>
              </div>

              {exporters.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 italic">No exporters recorded.</div>
              ) : (
                <div className="space-y-3">
                  {exporters.slice(0, 5).map((e, idx) => (
                    <div key={e.exporter} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-200 truncate max-w-[200px]" title={e.exporter}>
                          {e.exporter}
                        </span>
                        <div className="flex items-center space-x-2 font-mono text-[11px]">
                          <span className="text-gray-400" title={formatFullCurrency(e.total_value)}>
                            {formatCurrency(e.total_value)}
                          </span>
                          <span className="text-blue-400 font-bold">{e.percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#242424] h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${BAR_COLORS[(idx + 1) % BAR_COLORS.length]} transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.max(e.percentage, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. Issue 4: Detailed Stats View with Full Invoice Details */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-[#10b981]" />
                  <span>Detailed Shipment & Invoice Records</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Individual shipment invoices for {selectedImporter} including dates, BE/LC numbers, products, quantities, and values.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Exporter Filter Dropdown for Shipments */}
                {exporters.length > 0 && (
                  <select
                    value={selectedExporterFilter}
                    onChange={(e) => {
                      setSelectedExporterFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="bg-[#242424] border border-[#333333] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
                  >
                    <option value="">All Exporters ({exporters.length})</option>
                    {exporters.map((e) => (
                      <option key={e.exporter} value={e.exporter}>
                        {e.exporter}
                      </option>
                    ))}
                  </select>
                )}

                {/* Search Shipments */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search invoice, product, exporter..."
                    value={shipmentSearch}
                    onChange={(e) => {
                      setShipmentSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-[#242424] border border-[#333333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10b981]"
                  />
                </div>
              </div>
            </div>

            {/* Shipment Table */}
            <div className="overflow-x-auto custom-scrollbar border border-[#262626] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#242424] text-gray-400 font-semibold uppercase text-[10px] border-b border-[#333333]">
                  <tr>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-500" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('invoice_no')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Invoice / BE No</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-500" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('product')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Product Description</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-500" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-4 text-right cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Quantity</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-500" />
                      </div>
                    </th>
                    <th className="py-2.5 px-4 text-center">Unit</th>
                    <th
                      className="py-2.5 px-4 text-right cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('total_value')}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Total Value (USD)</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-500" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('exporter')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Exporter</span>
                        <ArrowUpDown className="w-3 h-3 text-gray-500" />
                      </div>
                    </th>
                    <th className="py-2.5 px-4 text-center">Raw Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {paginatedShipments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500 italic">
                        No shipment records match the criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedShipments.map((s, idx) => (
                      <tr key={idx} className="hover:bg-[#222222] transition-colors">
                        <td className="py-2.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                          {s.date || 'N/A'}
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          <span className="px-2 py-0.5 bg-[#242424] border border-[#333333] rounded text-[11px] text-emerald-400 font-semibold">
                            {s.invoice_no || 'N/A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-white max-w-xs truncate" title={s.product}>
                          {s.product}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-gray-300">
                          {s.quantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-xs text-gray-400">
                          <span className="px-1.5 py-0.5 bg-[#2a2a2a] rounded text-[10px]">{s.unit}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-white font-semibold whitespace-nowrap" title={formatFullCurrency(s.total_value)}>
                          {formatFullCurrency(s.total_value)}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-gray-300 max-w-xs truncate" title={s.exporter}>
                          {s.exporter}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedRawRecord(s.raw_row || s)}
                            className="p-1 rounded bg-[#242424] hover:bg-[#333333] text-gray-300 hover:text-white transition-colors"
                            title="Inspect full row data"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#10b981]" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredShipments.length > pageSize && (
              <div className="flex items-center justify-between border-t border-[#262626] pt-3 text-xs text-gray-400">
                <div>
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredShipments.length)} of {filteredShipments.length} shipments
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md bg-[#242424] border border-[#333333] text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-gray-200">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md bg-[#242424] border border-[#333333] text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 6. Products Table with Repetition Tracking */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Package className="w-4 h-4 text-[#10b981]" />
                  <span>Products Exported (With Repetition Tracking)</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Tracks total quantity, shipment repetition count, and export value per product.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10b981]"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar border border-[#262626] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#242424] text-gray-400 font-semibold uppercase text-[10px] border-b border-[#333333]">
                  <tr>
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4 text-center">Unit</th>
                    <th className="py-2.5 px-4 text-center">Shipments (Repetitions)</th>
                    <th className="py-2.5 px-4 text-right">Total Value (USD)</th>
                    <th className="py-2.5 px-4 text-right">% Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500 italic">
                        No matching products found.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, i) => (
                      <tr key={i} className="hover:bg-[#222222] transition-colors">
                        <td className="py-2.5 px-4 font-medium text-white max-w-xs truncate" title={p.product}>
                          {p.product}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-gray-300">
                          {p.quantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-xs text-gray-400">
                          <span className="px-1.5 py-0.5 bg-[#2a2a2a] rounded text-[10px]">{p.unit}</span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-[#10b981] font-bold">
                          <span className="px-2 py-0.5 bg-[#10b981]/10 border border-[#10b981]/20 rounded-full text-xs">
                            {p.shipments} {p.shipments === 1 ? 'time' : 'times'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-white font-semibold" title={formatFullCurrency(p.total_value)}>
                          {formatFullCurrency(p.total_value)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#10b981] font-bold">
                          {p.percentage}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7. Exporters Breakdown Table */}
          <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Exporters for this Importer</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Breakdown of manufacturing exporters supplying products to this importer.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter exporters..."
                  value={exporterSearch}
                  onChange={(e) => setExporterSearch(e.target.value)}
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar border border-[#262626] rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#242424] text-gray-400 font-semibold uppercase text-[10px] border-b border-[#333333]">
                  <tr>
                    <th className="py-2.5 px-4">Exporter Name</th>
                    <th className="py-2.5 px-4 text-center">Distinct Products</th>
                    <th className="py-2.5 px-4 text-center">Shipments Count</th>
                    <th className="py-2.5 px-4 text-right">Total Value (USD)</th>
                    <th className="py-2.5 px-4 text-right">% Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626]">
                  {filteredExporters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500 italic">
                        No matching exporters found.
                      </td>
                    </tr>
                  ) : (
                    filteredExporters.map((e, i) => (
                      <tr key={i} className="hover:bg-[#222222] transition-colors">
                        <td className="py-2.5 px-4 font-medium text-white max-w-xs truncate" title={e.exporter}>
                          {e.exporter}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-gray-300">
                          {e.products_count}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-gray-300">
                          {e.shipments}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-white font-semibold" title={formatFullCurrency(e.total_value)}>
                          {formatFullCurrency(e.total_value)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-blue-400 font-bold">
                          {e.percentage}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-12 text-center text-gray-400 space-y-3">
          <Building2 className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">Select a Country & Importer</h3>
          <p className="text-xs max-w-md mx-auto">
            Choose a country and importer from the filter dropdowns above to display detailed repetition analytics, exporter shares, and individual invoice records.
          </p>
        </div>
      )}

      {/* Raw Record Inspector Modal */}
      {selectedRawRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#262626]">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-sm font-bold text-white">Full Invoice / Shipment Record Data</h3>
              </div>
              <button
                onClick={() => setSelectedRawRecord(null)}
                className="p-1 rounded-lg hover:bg-[#262626] text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-2 font-mono text-xs">
              <div className="bg-[#121212] p-3 rounded-lg border border-[#262626] space-y-1.5">
                {Object.entries(selectedRawRecord).map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between py-1 border-b border-[#222222] last:border-0">
                    <span className="text-gray-400 font-medium">{key}:</span>
                    <span className="text-emerald-400 font-semibold break-all">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-[#262626] flex justify-end">
              <button
                onClick={() => setSelectedRawRecord(null)}
                className="px-4 py-2 bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl max-w-md w-full flex flex-col shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center space-x-2 text-red-400 font-bold">
                <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
                <h3 className="text-base text-white font-bold">Delete File</h3>
              </div>
              <button
                onClick={() => {
                  setFileToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="p-1 rounded-lg hover:bg-[#262626] text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-300 font-medium">Are you sure you want to delete this file?</p>

              <div className="bg-[#121212] border border-[#262626] p-3 rounded-lg space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">File Name:</span>
                  <span className="text-white font-semibold truncate max-w-[200px]">{fileToDelete.file_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rows:</span>
                  <span className="text-emerald-400 font-semibold">{fileToDelete.row_count.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Value:</span>
                  <span className="text-emerald-400 font-semibold">{formatFullCurrency(fileToDelete.total_value)}</span>
                </div>
              </div>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[11px] leading-relaxed">
                ⚠️ <strong>Warning:</strong> This action cannot be undone. All data associated with this file will be permanently removed from the History database.
              </div>

              <div className="space-y-1 pt-1">
                <label className="block text-gray-300 text-[11px] font-medium">
                  Type <span className="font-mono text-red-400 font-bold">"delete"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder='Type "delete"'
                  className="w-full bg-[#242424] border border-[#333333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-[#262626] pt-3">
              <button
                onClick={() => {
                  setFileToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 bg-[#262626] hover:bg-[#333333] text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'delete' || isDeletingFile}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors flex items-center space-x-1.5 ${
                  deleteConfirmText === 'delete' && !isDeletingFile
                    ? 'bg-red-600 hover:bg-red-500 cursor-pointer shadow-lg shadow-red-900/30'
                    : 'bg-red-950/50 text-gray-500 border border-red-900/20 cursor-not-allowed opacity-60'
                }`}
              >
                {isDeletingFile ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
