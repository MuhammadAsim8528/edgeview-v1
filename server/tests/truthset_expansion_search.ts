import { getAppSettings } from '../settings';
import { executeProviderAwareSearch } from '../orchestrator';
import { ResourceGovernor } from '../resource_governor';

const settings = getAppSettings();

const priorityEntities = [
  { company: "OSOO MEDSERVIS KG", country: "Kyrgyzstan", altNames: ["MEDSERVIS KE IDZHI"] },
  { company: "New Cesamex S.A.R.L", country: "Réunion", altNames: [] },
  { company: "SSG GLOBAL LTD.", country: "Tanzania", altNames: ["SSG GLOBAL"] },
  { company: "ALICO IMPEX INTERNATIONAL CORP.", country: "Philippines", altNames: ["ALICO IMPEX"] },
  { company: "VINCARE CONSULTING LIMITED", country: "Kenya", altNames: [] },
  { company: "AM LOGISTICS & SHIPPING CO LTD", country: "Nigeria", altNames: [] },
  { company: "ZILLION INTERNATIONAL TRADING PTE LTD", country: "Thailand", altNames: [] },
  { company: "M/S HANGZHOU ZEYI MEDICAL INSTRUMENTS CO LTD", country: "China", altNames: ["HANGZHOU ZEYI MEDICAL INSTRUMENTS"] },
  { company: "FEROZSONS LABORATRIES LIMITED", country: "Sri Lanka", altNames: ["FEROZSONS LABS"] },
  { company: "UNGUJA PHARMACY LIMITED", country: "Tanzania", altNames: [] },
  { company: "ALPHACEUTICALS LIMITADA", country: "Angola", altNames: [] },
];

async function searchCompany(company: string, country: string, altNames: string[] = []) {
  const names = [company, ...altNames].filter(Boolean);
  const queries = names.flatMap(name => [
    `"${name}" "${country}" contact`,
    `"${name}" "${country}" email`,
    `"${name}" "${country}" phone`,
    `"${name}" "${country}" address`,
    `"${name}" "${country}" website`,
    `"${name}" "${country}" "official website"`,
    `"${name}" "${country}" LinkedIn`,
  ]);

  const results: any[] = [];
  for (const query of queries) {
    try {
      const result = await executeProviderAwareSearch(query, 'company', settings, () => {}, company, {
        preferredProvider: 'serper',
        fallbackAttempts: 2,
      });
      results.push({ query, provider: result.providerUsed, urls: result.results.map(r => r.link).slice(0, 5) });
    } catch (e: any) {
      results.push({ query, error: e.message });
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

async function main() {
  console.log("=== TRUTHSET EXPANSION SEARCH ===");
  for (const entity of priorityEntities) {
    console.log(`\n--- ${entity.company} (${entity.country}) ---`);
    const results = await searchCompany(entity.company, entity.country, entity.altNames);
    for (const r of results) {
      if (r.urls) {
        console.log(`  [${r.provider}] ${r.query}`);
        r.urls.forEach(u => console.log(`    ${u}`));
      } else {
        console.log(`  [ERROR] ${r.query}: ${r.error}`);
      }
    }
  }
}

main().catch(e => console.error(e));