import { parseTradeNumeric } from './value_normalization';

// The existing upload projection, shared with offline reconciliation. SQL TEXT
// affinity is applied separately when comparing persisted database values.
export const HISTORY_VALUE_COLUMNS = ['be_link', 'be_date', 'hs_code', 'item', 'importer', 'exporter', 'country', 'tot_fc', 'qty', 'unit', 'agent_name', 'file_name', 'file_id'] as const;

function firstValue(row: Record<string, any>, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }
  return '';
}

function historyText(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  return ['string', 'number', 'boolean', 'bigint'].includes(typeof value) ? String(value) : '';
}

export function historyInsertValues(r: Record<string, any>, name: string, id: string): Array<string | number> {
  const total = parseTradeNumeric(firstValue(r,
    ['Total Value (USD)', 'Total FC (USD)', 'TOT_FC', 'tot_fc', 'VAL_USD', 'total_cost_usd', 'Invoice_Value', 'AMOUNT', 'Amount']));
  const quantity = parseTradeNumeric(firstValue(r, ['Qty', 'QTY', 'qty', 'Quantity', 'QUANTITY']));
  return [
    historyText(firstValue(r, ['be_link', 'BE_LINK', 'BE Link', 'BE_LINK_1'])),
    historyText(firstValue(r, ['Date', 'BE_DATE', 'be_date', 'BE Date', 'BE_DT', 'date', 'shipment_date', 'SHIP_DATE'])),
    historyText(firstValue(r, ['hs_code', 'HS_CODE', 'HS Code', 'Hs_Code'])),
    historyText(firstValue(r, ['item', 'Item', 'ITEM', 'product_name', 'goods_description'])),
    historyText(firstValue(r, ['importer', 'Importer', 'IMPORTER', 'importer_name', 'BUYER', 'BUYER_NAME', 'CONSIGNEE'])),
    historyText(firstValue(r, ['exporter', 'Exporter', 'EXPORTER', 'exporter_name', 'SUPPLIER', 'SUPPLIER_NAME', 'SELLER'])),
    historyText(firstValue(r, ['country', 'Country', 'COUNTRY', 'ORIGIN', 'origin'])),
    total ?? 0,
    quantity ?? 0,
    historyText(firstValue(r, ['unit', 'Unit', 'UNIT', 'UNT'])),
    historyText(firstValue(r, ['agent_name', 'AGENT_NAME', 'Agent Name', 'Agent'])),
    name,
    id,
  ];
}
