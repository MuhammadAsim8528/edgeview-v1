import React, { useState, useEffect, useMemo } from 'react';
import { processAndValidateExportResponse } from '../utils/exportValidator';
import { safeFetchJson, fetchAllFileRows } from '../utils/safeFetch';
import {
  Globe,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  Building2,
  Ship,
  DollarSign,
  Package,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Boxes,
} from 'lucide-react';
import { ParsedFile } from '../types';
import { GlobalExportPayload } from './GlobalExportModal';
import { formatCurrency, formatFullCurrency } from '../utils/formatters';

interface CountryViewProps {
  files?: ParsedFile[];
  selectedFile?: ParsedFile | null;
  onOpenExport?: (payload: GlobalExportPayload) => void;
}

interface CountrySummary {
  country: string;
  importers_count: number;
  total_export_value: number;
  exporters_count: number;
}

interface ImporterItem {
  importer: string;
  total_export_value: number;
  exporters_count: number;
}

interface ExporterDetail {
  exporter: string;
  product: string;
  quantity: number;
  unit: string;
  total_value: number;
}

export const CountryView: React.FC<CountryViewProps> = ({ files = [], selectedFile, onOpenExport }) => {
  const [countries, setCountries] = useState<{ country: string; importers_count: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Accordion state
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [countrySummaries, setCountrySummaries] = useState<Record<string, CountrySummary>>({});
  const [countryImporters, setCountryImporters] = useState<Record<string, ImporterItem[]>>({});
  const [loadingCountry, setLoadingCountry] = useState<Record<string, boolean>>({});

  const [expandedImporters, setExpandedImporters] = useState<Record<string, boolean>>({});
  const [importerDetails, setImporterDetails] = useState<Record<string, ExporterDetail[]>>({});
  const [loadingImporter, setLoadingImporter] = useState<Record<string, boolean>>({});

  // Collect all rows client-side as fallback / direct engine
  const clientRows = useMemo(() => {
    let rows: Record<string, any>[] = [];
    if (selectedFile && selectedFile.rows && selectedFile.rows.length > 0) {
      rows = selectedFile.rows;
    } else if (files && files.length > 0) {
      files.forEach((f) => {
        if (f.rows) rows.push(...f.rows);
      });
    }

    return rows.map((row) => {
      const country = row.Country || row.COUNTRY || row.DESTINATION_COUNTRY || row.cntry || row.ORIGIN || 'Unknown';
      const importer = row.Importer || row.IMPORTER || row.BUYER || row.BUYER_NAME || row.Consignee || 'Unknown Importer';
      const exporter = row.Exporter || row.EXPORTER || row.SELLER || row.SUPPLIER || row.SUPPLIER_NAME || 'Unknown Exporter';
      const product = row.Item || row.ITEM || row.PRODUCT || row.product_name || row.DESCRIPTION || 'Unknown Product';

      const fcVal = row['Total Value (USD)'] || row['Total FC (USD)'] || row.TOT_FC || row.VAL_USD || row.total_cost_usd || row.AMOUNT || 0;
      const total_value = typeof fcVal === 'number' ? fcVal : (parseFloat(String(fcVal)) || 0);

      const qtyVal = row.QTY || row.qty || row.Qty || row.QUANTITY || row.GROSS || row.NET || 0;
      const quantity = typeof qtyVal === 'number' ? qtyVal : (parseFloat(String(qtyVal)) || 0);

      const unit = row.UNT || row.unit || row.UNIT || row.UOM || row.qty_unit || 'KG';

      let cleanCountry = String(country).trim();
      if (!cleanCountry || cleanCountry.toLowerCase() === 'nan' || cleanCountry === '3004') cleanCountry = 'Unknown';
      else cleanCountry = cleanCountry.charAt(0).toUpperCase() + cleanCountry.slice(1).toLowerCase();

      return {
        country: cleanCountry,
        importer: String(importer).trim() || 'Unknown Importer',
        exporter: String(exporter).trim() || 'Unknown Exporter',
        product: String(product).trim() || 'Unknown Product',
        total_value,
        quantity,
        unit: String(unit).trim().toUpperCase() || 'KG',
      };
    });
  }, [files, selectedFile]);

  // Initial Country List Fetch
  useEffect(() => {
    let isMounted = true;
    async function fetchCountries() {
      setLoading(true);
      try {
        const fileParam = selectedFile ? `?file_id=${selectedFile.id}` : '';
        const { ok, data } = await safeFetchJson<{ country: string; importers_count: number }[]>(`/api/countries${fileParam}`);
        if (ok && Array.isArray(data)) {
          if (isMounted) {
            setCountries(data);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend country fetch failed, using client fallback:', err);
      }

      // Fallback: Group client rows by country
      if (isMounted) {
        const countryMap = new Map<string, Set<string>>();
        clientRows.forEach((r) => {
          if (!countryMap.has(r.country)) {
            countryMap.set(r.country, new Set());
          }
          if (r.importer && r.importer !== 'Unknown Importer') {
            countryMap.get(r.country)!.add(r.importer);
          }
        });

        const list = Array.from(countryMap.entries())
          .map(([country, impSet]) => ({
            country,
            importers_count: impSet.size,
          }))
          .sort((a, b) => a.country.localeCompare(b.country, undefined, { sensitivity: 'base' }));

        setCountries(list);
        setLoading(false);
      }
    }

    fetchCountries();
    return () => {
      isMounted = false;
    };
  }, [clientRows, selectedFile]);

  // Expand / Collapse Country
  const toggleCountry = async (countryName: string) => {
    const isCurrentlyExpanded = Boolean(expandedCountries[countryName]);
    setExpandedCountries((prev) => ({ ...prev, [countryName]: !isCurrentlyExpanded }));

    if (isCurrentlyExpanded) return;
    if (countrySummaries[countryName] && countryImporters[countryName]) return;

    setLoadingCountry((prev) => ({ ...prev, [countryName]: true }));

    try {
      const fileParam = selectedFile ? `?file_id=${selectedFile.id}` : '';
      const encodedCountry = encodeURIComponent(countryName);

      const [sumRes, impRes] = await Promise.all([
        safeFetchJson<CountrySummary>(`/api/countries/${encodedCountry}/summary${fileParam}`),
        safeFetchJson<ImporterItem[]>(`/api/countries/${encodedCountry}/importers${fileParam}`),
      ]);

      if (sumRes.ok && sumRes.data && impRes.ok && impRes.data) {
        setCountrySummaries((prev) => ({ ...prev, [countryName]: sumRes.data! }));
        setCountryImporters((prev) => ({ ...prev, [countryName]: impRes.data! }));
        setLoadingCountry((prev) => ({ ...prev, [countryName]: false }));
        return;
      }
    } catch (err) {
      console.warn('Country detail API fetch failed, using client fallback:', err);
    }

    // Client-side fallback for Country summary & importers
    const matched = clientRows.filter(
      (r) => r.country.toLowerCase() === countryName.toLowerCase()
    );

    const importers = new Set<string>();
    const exporters = new Set<string>();
    let totalVal = 0;

    const impMap = new Map<string, { importer: string; total_export_value: number; exporters: Set<string> }>();

    matched.forEach((r) => {
      if (r.importer && r.importer !== 'Unknown Importer') importers.add(r.importer);
      if (r.exporter && r.exporter !== 'Unknown Exporter') exporters.add(r.exporter);
      totalVal += r.total_value;

      if (!impMap.has(r.importer)) {
        impMap.set(r.importer, { importer: r.importer, total_export_value: 0, exporters: new Set() });
      }
      const item = impMap.get(r.importer)!;
      item.total_export_value += r.total_value;
      if (r.exporter && r.exporter !== 'Unknown Exporter') item.exporters.add(r.exporter);
    });

    const summary: CountrySummary = {
      country: countryName,
      importers_count: importers.size,
      total_export_value: totalVal,
      exporters_count: exporters.size,
    };

    const impList: ImporterItem[] = Array.from(impMap.values())
      .map((i) => ({
        importer: i.importer,
        total_export_value: i.total_export_value,
        exporters_count: i.exporters.size,
      }))
      .sort((a, b) => a.importer.localeCompare(b.importer, undefined, { sensitivity: 'base' }));

    setCountrySummaries((prev) => ({ ...prev, [countryName]: summary }));
    setCountryImporters((prev) => ({ ...prev, [countryName]: impList }));
    setLoadingCountry((prev) => ({ ...prev, [countryName]: false }));
  };

  // Expand / Collapse Importer
  const toggleImporter = async (countryName: string, importerName: string) => {
    const key = `${countryName}::${importerName}`;
    const isCurrentlyExpanded = Boolean(expandedImporters[key]);

    setExpandedImporters((prev) => ({ ...prev, [key]: !isCurrentlyExpanded }));

    if (isCurrentlyExpanded) return;
    if (importerDetails[key]) return;

    setLoadingImporter((prev) => ({ ...prev, [key]: true }));

    try {
      const fileParam = selectedFile ? `?file_id=${selectedFile.id}` : '';
      const encodedCountry = encodeURIComponent(countryName);
      const encodedImporter = encodeURIComponent(importerName);

      const { ok, data } = await safeFetchJson<ExporterDetail[]>(`/api/countries/${encodedCountry}/${encodedImporter}/details${fileParam}`);
      if (ok && Array.isArray(data)) {
        setImporterDetails((prev) => ({ ...prev, [key]: data }));
        setLoadingImporter((prev) => ({ ...prev, [key]: false }));
        return;
      }
    } catch (err) {
      console.warn('Importer details API fetch failed, using client fallback:', err);
    }

    // Client-side fallback for Importer Details
    const matched = clientRows.filter(
      (r) =>
        r.country.toLowerCase() === countryName.toLowerCase() &&
        r.importer.toLowerCase() === importerName.toLowerCase()
    );

    const details: ExporterDetail[] = matched.map((r) => ({
      exporter: r.exporter,
      product: r.product,
      quantity: r.quantity,
      unit: r.unit,
      total_value: r.total_value,
    }));

    setImporterDetails((prev) => ({ ...prev, [key]: details }));
    setLoadingImporter((prev) => ({ ...prev, [key]: false }));
  };

  // Filtered Countries
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const query = searchQuery.toLowerCase();
    return countries.filter((c) => c.country.toLowerCase().includes(query));
  }, [countries, searchQuery]);

  // Overall Aggregated Stats
  const globalStats = useMemo(() => {
    const uniqueCountries = new Set<string>();
    const uniqueImporters = new Set<string>();
    const uniqueExporters = new Set<string>();
    let totalValue = 0;

    clientRows.forEach((r) => {
      if (r.country && r.country !== 'Unknown') uniqueCountries.add(r.country);
      if (r.importer && r.importer !== 'Unknown Importer') uniqueImporters.add(r.importer);
      if (r.exporter && r.exporter !== 'Unknown Exporter') uniqueExporters.add(r.exporter);
      totalValue += r.total_value;
    });

    const authoritativeSummary = selectedFile?.summary;
    return {
      totalCountries: uniqueCountries.size || countries.length,
      // Parsed row bodies are loaded lazily for large files. Reuse authoritative
      // upload metadata when the browser intentionally does not hold every row.
      totalImporters: uniqueImporters.size
        || authoritativeSummary?.importers_count
        || countries.reduce((sum, item) => sum + (item.importers_count || 0), 0),
      totalExporters: uniqueExporters.size || authoritativeSummary?.exporters_count || 0,
      totalValue: totalValue || authoritativeSummary?.total_cost_usd || 0,
    };
  }, [clientRows, countries, selectedFile]);

  // Export Full Hierarchical Country Summary via Global Export Manager
  const [isExporting, setIsExporting] = useState(false);
  const handleExportFullReport = async () => {
    if (isExporting) return;
    if (onOpenExport) {
      const fileName = selectedFile?.name ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'All_Files';
      const exportRecords: Record<string, any>[] = [];
      setIsExporting(true);
      try {
        // Metadata-only uploads must be loaded individually; never substitute
        // another file's cached rows or publish a partially fetched report.
        for (const source of selectedFile ? [selectedFile] : files) {
          if (source.rows?.length) {
            for (const row of source.rows) exportRecords.push(row);
          } else {
            const result = await fetchAllFileRows(source.id);
            if (!result.ok || !result.data) {
              window.alert(result.error || 'Could not load the complete country report. Try again.');
              return;
            }
            for (const row of result.data.rows) exportRecords.push(row);
          }
        }
      } finally {
        setIsExporting(false);
      }
      if (exportRecords.length === 0) return;
      onOpenExport({
        dataset: 'country',
        title: `Country Trade Analytics (${selectedFile?.name || 'Global'})`,
        records: exportRecords,
        filenamePrefix: `EdgeView_Country_Analytics_${fileName}`,
      });
      return;
    }

    try {
      const fileParam = selectedFile ? `?file_id=${selectedFile.id}` : '';
      const res = await fetch(`/api/export/country/csv${fileParam}`);
      const { blob, filename } = await processAndValidateExportResponse(res, 'csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `Pharma_Country_Summary_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    } catch (err) {
      console.warn('Backend export failed or returned invalid response, falling back to client CSV:', err);
    }

    // Client-side CSV generation
    const csvRows: string[] = [];
    csvRows.push('Country,Importer Name,Exporter Name,Product Description,Quantity,Unit,Total Value (USD)');

    clientRows.forEach((r) => {
      const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;
      csvRows.push(
        `${esc(r.country)},${esc(r.importer)},${esc(r.exporter)},${esc(r.product)},${r.quantity},${esc(r.unit)},${r.total_value}`
      );
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pharma_Country_Report_Client_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0a0a] text-white p-4 sm:p-6 space-y-6 custom-scrollbar">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl text-[#10b981]">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Country Trade Analytics</span>
              {selectedFile && (
                <span className="text-xs bg-[#242424] text-[#10b981] border border-[#333333] px-2.5 py-0.5 rounded-full font-mono">
                  {selectedFile.name}
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Hierarchical breakdown by destination country, importers, and exporter product values.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportFullReport}
          id="export-full-country-report-btn"
          disabled={isExporting || (clientRows.length === 0 && countries.length === 0)}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#0d9668] disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Preparing report…' : 'Export Full Report'}</span>
        </button>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Countries</span>
            <Globe className="w-4 h-4 text-[#10b981]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {globalStats.totalCountries}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Active trade destinations</div>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Importers</span>
            <Building2 className="w-4 h-4 text-[#10b981]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#10b981] mt-2">
            {globalStats.totalImporters.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Importer-country entities</div>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Exporters</span>
            <Ship className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {globalStats.totalExporters > 0 ? globalStats.totalExporters.toLocaleString() : '-'}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Unique supply partners</div>
        </div>

        <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-4 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Total Trade Value</span>
            <DollarSign className="w-4 h-4 text-[#10b981]" />
          </div>
          <div
            className="text-2xl font-bold font-mono text-[#10b981] mt-2 truncate"
            title={formatFullCurrency(globalStats.totalValue)}
          >
            {globalStats.totalValue > 0 ? formatCurrency(globalStats.totalValue) : '-'}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Total valuation in USD</div>
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search country by name (e.g. Afghanistan, Bangladesh, Bahrain)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-[#262626] rounded-xl text-xs font-medium text-white placeholder-gray-500 focus:outline-none focus:border-[#10b981] shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Accordion Country List */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-[#242424] border-b border-[#262626] flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Countries A to Z ({filteredCountries.length})
          </span>
          <span className="text-xs text-gray-400 italic">
            Click any country to expand importers & summary
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-6 h-6 text-[#10b981] animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading country analytics data...</p>
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <AlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white">No matching countries found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your search query above.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#262626]">
            {filteredCountries.map((c) => {
              const isExpanded = Boolean(expandedCountries[c.country]);
              const summary = countrySummaries[c.country];
              const importers = countryImporters[c.country] || [];
              const isCountryLoading = Boolean(loadingCountry[c.country]);

              return (
                <div key={c.country} className="transition-colors">
                  {/* Level 1: Country Header Item */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${c.country} country details`}
                    onClick={() => toggleCountry(c.country)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void toggleCountry(c.country);
                      }
                    }}
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[#242424] transition-colors select-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#10b981]"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-400">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-[#10b981]" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <span className="text-sm font-bold text-white">
                          {c.country}
                        </span>
                        <span className="ml-2.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                          {c.importers_count} {c.importers_count === 1 ? 'importer' : 'importers'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#10b981] font-semibold flex items-center space-x-1">
                      <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                    </div>
                  </div>

                  {/* Expanded Country Content */}
                  {isExpanded && (
                    <div className="bg-[#121212] border-t border-[#262626] p-5 space-y-5 pl-10 md:pl-12">
                      {isCountryLoading ? (
                        <div className="p-4 flex items-center space-x-2 text-xs text-gray-400">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#10b981]" />
                          <span>Loading summary and importers list for {c.country}...</span>
                        </div>
                      ) : (
                        <>
                          {/* Level 2: Country Summary Card */}
                          {summary && (
                            <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 shadow-xs space-y-3">
                              <div className="text-xs font-bold text-[#10b981] uppercase tracking-wider flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-[#10b981]" />
                                <span>Country Summary: {summary.country}</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                <div className="border-r border-[#262626] last:border-0 pr-4">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                    Total Importers
                                  </span>
                                  <span className="text-lg font-bold font-mono text-white block mt-0.5">
                                    {summary.importers_count}
                                  </span>
                                </div>

                                <div className="border-r border-[#262626] last:border-0 pr-4">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                    Total Export Value
                                  </span>
                                  <span
                                    className="text-lg font-bold font-mono text-[#10b981] block mt-0.5 truncate max-w-[200px]"
                                    title={formatFullCurrency(summary.total_export_value)}
                                  >
                                    {formatCurrency(summary.total_export_value)}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                    Total Exporters (unique)
                                  </span>
                                  <span className="text-lg font-bold font-mono text-white block mt-0.5">
                                    {summary.exporters_count}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Level 3: Importer List */}
                          <div className="space-y-3">
                            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                              <span>Importers ({importers.length})</span>
                              <span className="text-[10px] text-gray-500 font-normal">Sorted A to Z</span>
                            </div>

                            {importers.length === 0 ? (
                              <div className="text-xs text-gray-500 italic p-3 bg-[#1a1a1a] rounded-lg border border-[#262626]">
                                No importers recorded for this country.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {importers.map((imp) => {
                                  const impKey = `${c.country}::${imp.importer}`;
                                  const isImpExpanded = Boolean(expandedImporters[impKey]);
                                  const details = importerDetails[impKey] || [];
                                  const isImpLoading = Boolean(loadingImporter[impKey]);

                                  return (
                                    <div
                                      key={imp.importer}
                                      className="bg-[#1a1a1a] border border-[#262626] rounded-lg overflow-hidden transition-all shadow-xs"
                                    >
                                      {/* Level 3 Importer Card Header */}
                                      <div
                                        onClick={() => toggleImporter(c.country, imp.importer)}
                                        className="p-3.5 flex flex-wrap items-center justify-between cursor-pointer hover:bg-[#242424] transition-colors select-none gap-2"
                                      >
                                        <div className="flex items-center space-x-2.5 min-w-0">
                                          <div className="text-gray-400 shrink-0">
                                            {isImpExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-[#10b981]" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4" />
                                            )}
                                          </div>
                                          <Building2 className="w-4 h-4 text-[#10b981] shrink-0" />
                                          <span className="text-xs font-bold text-white truncate">
                                            Importer: {imp.importer}
                                          </span>
                                        </div>

                                        <div className="flex items-center space-x-6 text-xs ml-6">
                                          <div>
                                            <span className="text-gray-400 text-[10px] uppercase block font-medium">
                                              Export Value
                                            </span>
                                            <span
                                              className="font-mono font-semibold text-[#10b981] block truncate max-w-[150px]"
                                              title={formatFullCurrency(imp.total_export_value)}
                                            >
                                              {formatCurrency(imp.total_export_value)}
                                            </span>
                                          </div>

                                          <div>
                                            <span className="text-gray-400 text-[10px] uppercase block font-medium">
                                              Exporters
                                            </span>
                                            <span className="font-mono font-medium text-gray-200">
                                              {imp.exporters_count}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Level 4: Exporter Breakdown Details Table */}
                                      {isImpExpanded && (
                                        <div className="border-t border-[#262626] bg-[#141414] p-3">
                                          {isImpLoading ? (
                                            <div className="p-3 flex items-center space-x-2 text-xs text-gray-400">
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#10b981]" />
                                              <span>Loading exporter breakdown...</span>
                                            </div>
                                          ) : details.length === 0 ? (
                                            <div className="text-xs text-gray-500 italic p-2">
                                              No detailed breakdown records available.
                                            </div>
                                          ) : (
                                            <div className="overflow-x-auto rounded-lg border border-[#262626] bg-[#1a1a1a]">
                                              <table className="w-full text-xs text-left">
                                                <thead className="bg-[#242424] text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-[#262626]">
                                                  <tr>
                                                    <th className="px-3.5 py-2.5">Exporter Name</th>
                                                    <th className="px-3.5 py-2.5">Product</th>
                                                    <th className="px-3.5 py-2.5 text-right">Quantity</th>
                                                    <th className="px-3.5 py-2.5">Unit</th>
                                                    <th className="px-3.5 py-2.5 text-right text-[#10b981]">
                                                      Total Value ($)
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#262626] text-gray-200 font-medium">
                                                  {details.map((dt, dIdx) => (
                                                    <tr
                                                      key={dIdx}
                                                      className="hover:bg-[#222222] transition-colors"
                                                    >
                                                      <td className="px-3.5 py-2 text-white font-semibold">
                                                        {dt.exporter}
                                                      </td>
                                                      <td className="px-3.5 py-2 text-gray-300">
                                                        {dt.product}
                                                      </td>
                                                      <td className="px-3.5 py-2 text-right font-mono">
                                                        {dt.quantity > 0 ? dt.quantity.toLocaleString() : '—'}
                                                      </td>
                                                      <td className="px-3.5 py-2 font-mono text-gray-400">
                                                        {dt.unit || 'KG'}
                                                      </td>
                                                      <td className="px-3.5 py-2 text-right font-mono text-[#10b981] font-bold">
                                                        ${dt.total_value.toLocaleString(undefined, {
                                                          minimumFractionDigits: 2,
                                                          maximumFractionDigits: 2,
                                                        })}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
