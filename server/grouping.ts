export const EXPRESS_COLUMN_MAP: Record<string, string> = {
  BE_DATE: 'Date', be_date: 'Date', shipment_date: 'Date', SHIP_DATE: 'Date', BE_DATE_1: 'Date',
  ITEM: 'Item', item: 'Item', product_name: 'Item', Drug_Class: 'Item', CAT_NUMBER: 'Item',
  IMPORTER: 'Importer', importer: 'Importer', importer_name: 'Importer', BUYER_NAME: 'Importer', Customer_Name: 'Importer',
  EXPORTER: 'Exporter', exporter: 'Exporter', exporter_name: 'Exporter', SUPPLIER_NAME: 'Exporter', Supplier_Name: 'Exporter',
  TOT_FC: 'Total Value (USD)', tot_fc: 'Total Value (USD)', total_cost_usd: 'Total Value (USD)', VAL_USD: 'Total Value (USD)', Invoice_Value: 'Total Value (USD)',
  AGENT_NAME: 'Agent', agent_name: 'Agent', AGENT: 'Agent', PORT: 'Agent',
  COUNTRY: 'Country', country: 'Country', country_name: 'Country', COUNTRY_NAME: 'Country',
  DESTINATION_COUNTRY: 'Country', destination_country: 'Country',
  cntry: 'Country', CNTRY: 'Country',
};

export function normalizeRow(row: Record<string, any>): Record<string, any> {
  if (!row || typeof row !== 'object') return {};
  const mapped: Record<string, any> = { ...row };
  for (const [k, v] of Object.entries(row)) {
    if (EXPRESS_COLUMN_MAP[k]) {
      mapped[EXPRESS_COLUMN_MAP[k]] = v;
    } else if (EXPRESS_COLUMN_MAP[k.toUpperCase()]) {
      mapped[EXPRESS_COLUMN_MAP[k.toUpperCase()]] = v;
    }
  }
  return mapped;
}

const QTY_KEYS = ['Qty', 'qty', 'QTY', 'Quantity', 'quantity', 'QUANTITY'];

function readQty(normR: Record<string, any>, row: Record<string, any>): number {
  for (const k of QTY_KEYS) {
    const val = normR[k] ?? row[k];
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return NaN;
}

export function groupShipmentRows(rows: Record<string, any>[]): Record<string, any>[] {
  const groupsMap = new Map<string, {
    key: string;
    items: string[];
    date: string;
    country: string;
    importer: string;
    exporter: string;
    tot_fc_values: number[];
    qty_values: number[];
    sampleRow: Record<string, any>;
  }>();

  for (const row of rows) {
    const normR = normalizeRow(row);

    let groupKey = '';
    const possibleKeys = [
      'BE_LINK', 'be_link', 'LC_NO', 'lc_no', 'BE_NO', 'be_no',
      'INVOICE_NO', 'invoice_no', 'BILL_NO', 'bill_no', 'IGM_NO', 'igm_no',
      'SHIPMENT_ID', 'shipment_id', 'group_link', 'GROUP_LINK'
    ];

    for (const k of possibleKeys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        groupKey = String(row[k]).trim();
        break;
      }
    }

    const dateVal = String(normR['Date'] || normR['BE_DATE'] || row['Date'] || '').trim();
    const countryVal = String(normR['Country'] || normR['COUNTRY'] || row['Country'] || '').trim();
    const importerVal = String(normR['Importer'] || normR['IMPORTER'] || row['Importer'] || '').trim();
    const exporterVal = String(normR['Exporter'] || normR['EXPORTER'] || row['Exporter'] || '').trim();

    if (!groupKey) {
      groupKey = `${dateVal}_${countryVal}_${importerVal}_${exporterVal}`.toLowerCase().trim();
    }

    if (!groupKey || groupKey === '___') {
      groupKey = `row_${Math.random()}`;
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        key: groupKey,
        items: [],
        date: dateVal,
        country: countryVal,
        importer: importerVal,
        exporter: exporterVal,
        tot_fc_values: [],
        qty_values: [],
        sampleRow: normR,
      });
    }

    const group = groupsMap.get(groupKey)!;

    const itemVal = String(normR['Item'] || normR['ITEM'] || row['Item'] || '').trim();
    if (itemVal && !group.items.includes(itemVal)) {
      group.items.push(itemVal);
    }

    const fcVal = normR['Total Value (USD)'] || normR['Total FC (USD)'] || normR['TOT_FC'] || row['Total Value (USD)'] || row['Total FC (USD)'];
    const numFc = Number(fcVal);
    if (!isNaN(numFc) && numFc > 0) {
      group.tot_fc_values.push(numFc);
    }

    const numQty = readQty(normR, row);
    if (!isNaN(numQty) && numQty > 0) {
      group.qty_values.push(numQty);
    }
  }

  const groupedResult: Record<string, any>[] = [];
  for (const grp of groupsMap.values()) {
    const combinedItems = grp.items.join(', ');

    let totFc = 0;
    if (grp.tot_fc_values.length > 0) {
      const allSame = grp.tot_fc_values.every((v) => Math.abs(v - grp.tot_fc_values[0]) < 0.001);
      if (allSame) {
        totFc = grp.tot_fc_values[0];
      } else {
        totFc = grp.tot_fc_values.reduce((sum, v) => sum + v, 0);
      }
    }

    let totQty = grp.sampleRow['Qty'] ?? grp.sampleRow['qty'] ?? grp.sampleRow['Quantity'] ?? '';
    if (grp.qty_values.length > 0) {
      const allSame = grp.qty_values.every((v) => Math.abs(v - grp.qty_values[0]) < 0.001);
      totQty = allSame ? grp.qty_values[0] : grp.qty_values.reduce((sum, v) => sum + v, 0);
    }

    groupedResult.push({
      ...grp.sampleRow,
      Date: grp.date,
      Country: grp.country,
      Importer: grp.importer,
      Exporter: grp.exporter,
      'Total Value (USD)': totFc,
      'Total FC (USD)': totFc,
      Qty: totQty,
      Quantity: totQty,
      Item: combinedItems,
      date: grp.date,
      country: grp.country,
      importer: grp.importer,
      exporter: grp.exporter,
      total_fc_usd: totFc,
      item: combinedItems,
    });
  }

  return groupedResult;
}