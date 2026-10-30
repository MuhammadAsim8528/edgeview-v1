// The existing upload projection, shared with offline reconciliation. SQL TEXT
// affinity is applied separately when comparing persisted database values.
export const HISTORY_VALUE_COLUMNS = ['be_link', 'be_date', 'hs_code', 'item', 'importer', 'exporter', 'country', 'tot_fc', 'qty', 'unit', 'agent_name', 'file_name', 'file_id'] as const;
export function historyInsertValues(r: Record<string, any>, name: string, id: string): unknown[] {
  return [r.be_link || r['BE Link'] || '', r.be_date || r['BE Date'] || '', r.hs_code || r['HS Code'] || '',
    r.item || r.Item || r.ITEM || '', r.importer || r.Importer || r.IMPORTER || r.BUYER || '',
    r.exporter || r.Exporter || r.EXPORTER || r.SUPPLIER || '', r.country || r.Country || r.COUNTRY || r.ORIGIN || '',
    typeof r['Total Value (USD)'] === 'number' ? r['Total Value (USD)'] : typeof r['Total FC (USD)'] === 'number' ? r['Total FC (USD)'] : typeof r.TOT_FC === 'number' ? r.TOT_FC : 0,
    typeof r.Qty === 'number' ? r.Qty : 0, r.unit || r.Unit || r.UNIT || '', r.agent_name || r['Agent Name'] || '', name, id];
}
