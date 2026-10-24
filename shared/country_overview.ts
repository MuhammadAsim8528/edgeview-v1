export interface CountryTradeRow { country: string; importer: string; exporter: string; total_value: number }
export interface CountryOverview {
  countries: Array<{ country: string; importers_count: number }>;
  stats: { totalCountries: number; totalImporters: number; totalExporters: number; totalValue: number };
}

export function isCountryOverview(value: any): value is CountryOverview {
  const count = (number: unknown) => Number.isSafeInteger(number) && Number(number) >= 0;
  return Boolean(value && Array.isArray(value.countries) && value.stats
    && value.countries.every((item: any) => item && typeof item.country === 'string' && count(item.importers_count))
    && ['totalCountries', 'totalImporters', 'totalExporters'].every(key => count(value.stats[key]))
    && Number.isFinite(value.stats.totalValue)
    && value.stats.totalCountries === value.countries.length
    && value.stats.totalImporters === value.countries.reduce((sum: number, item: any) => sum + item.importers_count, 0));
}

/** Same name/country counting contract as the existing country drill-down API. */
export function buildCountryOverview(rows: readonly CountryTradeRow[]): CountryOverview {
  const countries = new Map<string, Set<string>>();
  const exporters = new Set<string>();
  let totalValue = 0;
  for (const row of rows) {
    if (!countries.has(row.country)) countries.set(row.country, new Set());
    if (row.importer && row.importer !== 'Unknown Importer') countries.get(row.country)!.add(row.importer);
    if (row.exporter && row.exporter !== 'Unknown Exporter') exporters.add(row.exporter);
    totalValue += row.total_value;
  }
  const list = [...countries].map(([country, importers]) => ({ country, importers_count: importers.size }))
    .sort((a, b) => a.country.localeCompare(b.country, undefined, { sensitivity: 'base' }));
  return { countries: list, stats: { totalCountries: list.length, totalImporters: list.reduce((sum, item) => sum + item.importers_count, 0),
    totalExporters: exporters.size, totalValue: Math.round(totalValue * 100) / 100 } };
}
