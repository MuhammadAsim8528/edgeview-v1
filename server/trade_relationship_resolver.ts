import { db } from './db';
import { getDb } from './sqlite';
import { canonicalCountryIdentityKey, canonicalEntityIdentityKey } from './company_identity';

export interface ResolvedTradeRelationship {
  partnerName: string;
  country: string;
  itemDescription?: string;
  totalVal?: number;
  shipmentCount: number;
}

export class TradeRelationshipResolver {
  /**
   * Cleans and normalizes a company name for conservative matching.
   * Removes punctuation, common corporate suffixes, and extra spaces.
   */
  public static cleanCompanyName(name: string): string {
    if (!name) return '';
    let clean = name.trim().toLowerCase();

    // Remove common corporate designators (with word boundaries or endings)
    const suffixes = [
      /\bprivate\s+limited\b/g,
      /\bpvt\W+ltd\b/g,
      /\bpvt\s+ltd\b/g,
      /\bltd\b/g,
      /\blimited\b/g,
      /\bcorp\b/g,
      /\bcorporation\b/g,
      /\binc\b/g,
      /\bincorporated\b/g,
      /\bllc\b/g,
      /\bco\b/g,
      /\bcompany\b/g,
      /\bgmbh\b/g,
      /\bag\b/g,
      /\bs\.a\b/g,
      /\bpty\b/g,
      /\blabs\b/g,
      /\blaboratories\b/g,
    ];

    for (const suffix of suffixes) {
      clean = clean.replace(suffix, '');
    }

    // Strip out all non-alphanumeric characters
    clean = clean.replace(/[^a-z0-9]/g, ' ');
    // Collapse multiple spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
  }

  /**
   * Safely normalizes an NTN number.
   */
  public static cleanNtn(ntn: any): string {
    if (ntn === null || ntn === undefined) return '';
    const str = String(ntn).trim().toLowerCase();
    if (!str || str === 'n/a' || str === 'unknown' || str === 'null') return '';
    // Strip trailing decimals if Excel float
    let clean = str;
    if (clean.endsWith('.0')) {
      clean = clean.slice(0, -2);
    }
    // Remove non-alphanumeric characters
    return clean.replace(/[^a-z0-9]/g, '');
  }

  /**
   * Resolves trade relationships for a target company name conservatively.
   * Scrapes through current memory files (db.files) and database history_data.
   */
  public static async resolveRelationships(
    companyName: string,
    role: 'importer' | 'exporter' | 'both' = 'both',
    country?: string
  ): Promise<{ importedFrom: ResolvedTradeRelationship[]; suppliedTo: ResolvedTradeRelationship[] }> {
    const importedFromMap = new Map<string, ResolvedTradeRelationship>();
    const suppliedToMap = new Map<string, ResolvedTradeRelationship>();

    const targetClean = this.cleanCompanyName(companyName);
    const targetCountry = canonicalCountryIdentityKey(country);
    if (!targetClean) {
      return { importedFrom: [], suppliedTo: [] };
    }

    // 1. Resolve from current in-memory files (db.files)
    try {
      for (const file of db.files.values()) {
        const cols = file.columns;
        const impCol = cols.find((c: string) => /(importer|import|buyer|customer|consignee)/i.test(c));
        const expCol = cols.find((c: string) => /(exporter|export|seller|supplier|vendor)/i.test(c));
        const countryCol = cols.find((c: string) => /(country|origin|dest)/i.test(c));
        const itemCol = cols.find((c: string) => /(item|product|drug|desc)/i.test(c));
        const costCol = cols.find((c: string) => /(cost|value|price|tot_fc|val_usd|invoice_value)/i.test(c));
        const ntnCol = cols.find((c: string) => /(ntn|ntn_no)/i.test(c));

        if (impCol && expCol) {
          for (const row of file.rows) {
            const rawImp = String(row[impCol] || '').trim();
            const rawExp = String(row[expCol] || '').trim();
            const rawCountry = countryCol ? String(row[countryCol] || 'Unknown').trim() : 'Unknown';
            const rawItem = itemCol ? String(row[itemCol] || '').trim() : undefined;
            const rawCost = costCol ? Number(String(row[costCol] || '0').replace(/[^0-9.-]/g, '')) : 0;
            const rawNtn = ntnCol ? String(row[ntnCol] || '').trim() : '';

            const impClean = this.cleanCompanyName(rawImp);
            const expClean = this.cleanCompanyName(rawExp);

            // Match Importer (resolves what exporters they imported from)
            if (role !== 'exporter' && impClean && impClean === targetClean && (!targetCountry || canonicalCountryIdentityKey(rawCountry) === targetCountry)) {
              if (rawExp && rawExp.toLowerCase() !== 'n/a') {
                const partnerKey = rawExp.toLowerCase().trim();
                const existing = importedFromMap.get(partnerKey) || {
                  partnerName: rawExp,
                  country: rawCountry,
                  itemDescription: rawItem,
                  totalVal: 0,
                  shipmentCount: 0,
                };
                existing.totalVal = (existing.totalVal || 0) + rawCost;
                existing.shipmentCount++;
                if (rawItem && !existing.itemDescription?.includes(rawItem)) {
                  existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
                }
                importedFromMap.set(partnerKey, existing);
              }
            }

            // Match Exporter (resolves what importers they supplied to)
            if (role !== 'importer' && expClean && expClean === targetClean) {
              if (rawImp && rawImp.toLowerCase() !== 'n/a') {
                const partnerKey = rawImp.toLowerCase().trim();
                const existing = suppliedToMap.get(partnerKey) || {
                  partnerName: rawImp,
                  country: rawCountry,
                  itemDescription: rawItem,
                  totalVal: 0,
                  shipmentCount: 0,
                };
                existing.totalVal = (existing.totalVal || 0) + rawCost;
                existing.shipmentCount++;
                if (rawItem && !existing.itemDescription?.includes(rawItem)) {
                  existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
                }
                suppliedToMap.set(partnerKey, existing);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error resolving trade relationships from files:', err);
    }

    // 2. Resolve from SQLite History DB
    try {
      const sqliteDb = await getDb();
      const query = `
        SELECT importer, exporter, country, item, tot_fc 
        FROM history_data 
        WHERE LOWER(importer) LIKE ? OR LOWER(exporter) LIKE ?
      `;
      const searchPattern = `%${companyName.toLowerCase().trim()}%`;
      const rows = await sqliteDb.all(query, [searchPattern, searchPattern]);

      for (const row of rows) {
        const rawImp = String(row.importer || '').trim();
        const rawExp = String(row.exporter || '').trim();
        const rawCountry = String(row.country || 'Unknown').trim();
        const rawItem = String(row.item || '').trim();
        const rawCost = Number(row.tot_fc || 0);

        const impClean = this.cleanCompanyName(rawImp);
        const expClean = this.cleanCompanyName(rawExp);

        if (role !== 'exporter' && impClean && impClean === targetClean && (!targetCountry || canonicalCountryIdentityKey(rawCountry) === targetCountry)) {
          if (rawExp && rawExp.toLowerCase() !== 'n/a') {
            const partnerKey = rawExp.toLowerCase().trim();
            const existing = importedFromMap.get(partnerKey) || {
              partnerName: rawExp,
              country: rawCountry,
              itemDescription: rawItem,
              totalVal: 0,
              shipmentCount: 0,
            };
            existing.totalVal = (existing.totalVal || 0) + rawCost;
            existing.shipmentCount++;
            if (rawItem && !existing.itemDescription?.includes(rawItem)) {
              existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
            }
            importedFromMap.set(partnerKey, existing);
          }
        }

        if (role !== 'importer' && expClean && expClean === targetClean) {
          if (rawImp && rawImp.toLowerCase() !== 'n/a') {
            const partnerKey = rawImp.toLowerCase().trim();
            const existing = suppliedToMap.get(partnerKey) || {
              partnerName: rawImp,
              country: rawCountry,
              itemDescription: rawItem,
              totalVal: 0,
              shipmentCount: 0,
            };
            existing.totalVal = (existing.totalVal || 0) + rawCost;
            existing.shipmentCount++;
            if (rawItem && !existing.itemDescription?.includes(rawItem)) {
              existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
            }
            suppliedToMap.set(partnerKey, existing);
          }
        }
      }
    } catch (err) {
      console.warn('Error resolving trade relationships from SQLite:', err);
    }

    return {
      importedFrom: Array.from(importedFromMap.values()),
      suppliedTo: Array.from(suppliedToMap.values()),
    };
  }

  /**
   * Builds a reusable single-pass trade index for batch export operations across 17k+ rows.
   */
  public static async buildTradeIndex(): Promise<{
    importedFrom: Map<string, Map<string, ResolvedTradeRelationship>>;
    suppliedTo: Map<string, Map<string, ResolvedTradeRelationship>>;
  }> {
    const index = {
      importedFrom: new Map<string, Map<string, ResolvedTradeRelationship>>(),
      suppliedTo: new Map<string, Map<string, ResolvedTradeRelationship>>(),
    };

    // 1. Process in-memory files
    const loadedTradeFileNames = new Set<string>();
    for (const file of db.files.values()) {
      const cols = file.columns;
      const impCol = cols.find((c: string) => /(importer|import|buyer|customer|consignee)/i.test(c));
      const expCol = cols.find((c: string) => /(exporter|export|seller|supplier|vendor)/i.test(c));
      const countryCol = cols.find((c: string) => /(country|origin|dest)/i.test(c));
      const itemCol = cols.find((c: string) => /(item|product|drug|desc)/i.test(c));
      const costCol = cols.find((c: string) => /(cost|value|price|tot_fc|val_usd|invoice_value)/i.test(c));

      if (impCol && expCol) {
        // Real uploads are stored BOTH in db.files (memory) AND in history_data
        // (SQLite). Record this file so its rows are not counted twice in step 2.
        if (file.name) loadedTradeFileNames.add(file.name);
        for (const row of file.rows) {
          const rawImp = String(row[impCol] || '').trim();
          const rawExp = String(row[expCol] || '').trim();
          const rawCountry = countryCol ? String(row[countryCol] || 'Unknown').trim() : 'Unknown';
          const rawItem = itemCol ? String(row[itemCol] || '').trim() : undefined;
          const rawCost = costCol ? Number(String(row[costCol] || '0').replace(/[^0-9.-]/g, '')) : 0;

          const impClean = this.cleanCompanyName(rawImp);
          const expClean = this.cleanCompanyName(rawExp);

          if (impClean && rawExp && rawExp.toLowerCase() !== 'n/a') {
            const importerEntityKey = canonicalEntityIdentityKey(impClean, rawCountry);
            if (!index.importedFrom.has(importerEntityKey)) index.importedFrom.set(importerEntityKey, new Map());
            const compMap = index.importedFrom.get(importerEntityKey)!;
            const partnerKey = rawExp.toLowerCase().trim();
            const existing = compMap.get(partnerKey) || {
              partnerName: rawExp,
              country: rawCountry,
              itemDescription: rawItem,
              totalVal: 0,
              shipmentCount: 0,
            };
            existing.totalVal = (existing.totalVal || 0) + rawCost;
            existing.shipmentCount++;
            if (rawItem && !existing.itemDescription?.includes(rawItem)) {
              existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
            }
            compMap.set(partnerKey, existing);
          }

          if (expClean && rawImp && rawImp.toLowerCase() !== 'n/a') {
            if (!index.suppliedTo.has(expClean)) index.suppliedTo.set(expClean, new Map());
            const compMap = index.suppliedTo.get(expClean)!;
            const partnerKey = rawImp.toLowerCase().trim();
            const existing = compMap.get(partnerKey) || {
              partnerName: rawImp,
              country: rawCountry,
              itemDescription: rawItem,
              totalVal: 0,
              shipmentCount: 0,
            };
            existing.totalVal = (existing.totalVal || 0) + rawCost;
            existing.shipmentCount++;
            if (rawItem && !existing.itemDescription?.includes(rawItem)) {
              existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
            }
            compMap.set(partnerKey, existing);
          }
        }
      }
    }

    // 2. Process SQLite DB history_data
    try {
      const sqliteDb = await getDb();
      const rows = await sqliteDb.all('SELECT file_name, importer, exporter, country, item, tot_fc FROM history_data');
      for (const row of rows) {
        // Rows for files that are currently loaded in memory were already
        // counted in step 1 (real uploads exist in both stores). Skip them so
        // each shipment is counted exactly once. Rows for files no longer in
        // memory (kept only in the History DB) are still counted here.
        if (row.file_name && loadedTradeFileNames.has(String(row.file_name))) continue;

        const rawImp = String(row.importer || '').trim();
        const rawExp = String(row.exporter || '').trim();
        const rawCountry = String(row.country || 'Unknown').trim();
        const rawItem = String(row.item || '').trim();
        const rawCost = Number(row.tot_fc || 0);

        const impClean = this.cleanCompanyName(rawImp);
        const expClean = this.cleanCompanyName(rawExp);

        if (impClean && rawExp && rawExp.toLowerCase() !== 'n/a') {
          const importerEntityKey = canonicalEntityIdentityKey(impClean, rawCountry);
          if (!index.importedFrom.has(importerEntityKey)) index.importedFrom.set(importerEntityKey, new Map());
          const compMap = index.importedFrom.get(importerEntityKey)!;
          const partnerKey = rawExp.toLowerCase().trim();
          const existing = compMap.get(partnerKey) || {
            partnerName: rawExp,
            country: rawCountry,
            itemDescription: rawItem,
            totalVal: 0,
            shipmentCount: 0,
          };
          existing.totalVal = (existing.totalVal || 0) + rawCost;
          existing.shipmentCount++;
          if (rawItem && !existing.itemDescription?.includes(rawItem)) {
            existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
          }
          compMap.set(partnerKey, existing);
        }

        if (expClean && rawImp && rawImp.toLowerCase() !== 'n/a') {
          if (!index.suppliedTo.has(expClean)) index.suppliedTo.set(expClean, new Map());
          const compMap = index.suppliedTo.get(expClean)!;
          const partnerKey = rawImp.toLowerCase().trim();
          const existing = compMap.get(partnerKey) || {
            partnerName: rawImp,
            country: rawCountry,
            itemDescription: rawItem,
            totalVal: 0,
            shipmentCount: 0,
          };
          existing.totalVal = (existing.totalVal || 0) + rawCost;
          existing.shipmentCount++;
          if (rawItem && !existing.itemDescription?.includes(rawItem)) {
            existing.itemDescription = existing.itemDescription ? `${existing.itemDescription}, ${rawItem}` : rawItem;
          }
          compMap.set(partnerKey, existing);
        }
      }
    } catch (_) {}

    return index;
  }

  /**
   * Fast O(1) resolution from a pre-built trade index.
   */
  public static resolveFromIndex(
    companyName: string,
    tradeIndex: {
      importedFrom: Map<string, Map<string, ResolvedTradeRelationship>>;
      suppliedTo: Map<string, Map<string, ResolvedTradeRelationship>>;
    },
    role: 'importer' | 'exporter' | 'both' = 'both',
    country?: string
  ): { importedFrom: ResolvedTradeRelationship[]; suppliedTo: ResolvedTradeRelationship[] } {
    const clean = this.cleanCompanyName(companyName);
    const importerKey = canonicalEntityIdentityKey(clean, country);
    let impMap = role !== 'exporter' ? tradeIndex.importedFrom.get(importerKey) : undefined;
    // Compatibility for callers that genuinely have no country context: merge
    // all country-specific variants. Country-aware application paths must pass
    // country and therefore never enter this branch.
    if (!country && role !== 'exporter' && !impMap) {
      const combined = new Map<string, ResolvedTradeRelationship>();
      for (const [key, relationships] of tradeIndex.importedFrom) {
        if (key !== clean && !key.startsWith(`${clean}__`)) continue;
        for (const [partnerKey, relationship] of relationships) {
          const existing = combined.get(partnerKey);
          if (!existing) combined.set(partnerKey, { ...relationship });
          else {
            existing.shipmentCount += relationship.shipmentCount || 0;
            existing.totalVal = (existing.totalVal || 0) + (relationship.totalVal || 0);
          }
        }
      }
      impMap = combined.size ? combined : undefined;
    }
    const expMap = role !== 'importer' ? tradeIndex.suppliedTo.get(clean) : undefined;

    return {
      importedFrom: impMap ? Array.from(impMap.values()) : [],
      suppliedTo: expMap ? Array.from(expMap.values()) : [],
    };
  }
}
