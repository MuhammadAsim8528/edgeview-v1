import fs from 'fs';
import path from 'path';
import { enrichCompanyDetails } from '../enrichment';
import { getAppSettings } from '../settings';

const truthPath = path.resolve('.agent/benchmarks/IMPORTER_CONTACT_RECOVERY_TRUTHSET_V1_FROZEN.json');
const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+?/, '');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizeWebsite(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return url.toLowerCase(); }
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[\s,.\-]+/g, ' ').trim();
}

function matchFact(field: string, predicted: any, expected: string): boolean {
  if (!predicted && predicted !== 0) return false;
  const exp = expected.toLowerCase().trim();
  switch (field) {
    case 'email':
      const emails = Array.isArray(predicted) ? predicted : predicted ? [predicted] : [];
      return emails.some((e: string) => normalizeEmail(e) === normalizeEmail(exp));
    case 'phone':
      const phones = Array.isArray(predicted) ? predicted : predicted ? [predicted] : [];
      return phones.some((p: string) => normalizePhone(p) === normalizePhone(exp));
    case 'website':
      const sites = Array.isArray(predicted) ? predicted : predicted ? [predicted] : [];
      return sites.some((w: string) => normalizeWebsite(w) === normalizeWebsite(exp));
    case 'address':
      const addrs = Array.isArray(predicted) 
        ? predicted.map((a: any) => typeof a === 'string' ? a : a.address || '')
        : predicted ? [typeof predicted === 'string' ? predicted : predicted.address || ''] : [];
      return addrs.some((a: string) => normalizeAddress(a).includes(normalizeAddress(exp)) || normalizeAddress(exp).includes(normalizeAddress(a)));
    case 'leaders':
      return String(predicted) === String(expected);
    case 'fax':
      const faxes = Array.isArray(predicted) ? predicted : predicted ? [predicted] : [];
      return faxes.some((f: string) => normalizePhone(f) === normalizePhone(exp));
    case 'leadership':
      return String(predicted).toLowerCase().includes(String(expected).toLowerCase());
    default:
      return String(predicted).toLowerCase().includes(String(expected).toLowerCase());
  }
}

async function runBenchmark() {
  console.log('=== LIVE V2.1 BENCHMARK REPLAY (FOCUSED) ===\n');
  
  const results: any[] = [];
  let totalVerified = 0;
  let totalRecovered = 0;
  
  // Test a focused subset first
  const testEntities = truth.entities
    .filter((e: any) => e.facts.some((f: any) => f.status === 'VERIFIED'))
    .slice(0, 8); // First 8 entities
  
  console.log(`Testing ${testEntities.length} entities with VERIFIED facts...\n`);
  
  for (const entity of testEntities) {
    const verifiedFacts = entity.facts.filter((f: any) => f.status === 'VERIFIED');
    totalVerified += verifiedFacts.length;
    
    console.log(`\n--- ${entity.company} (${entity.country}) ---`);
    console.log(`  VERIFIED facts to recover: ${verifiedFacts.length}`);
    
    try {
      const extraContext = { 
        country: entity.country, 
        role: 'Importer' as 'Importer' | 'Exporter',
        deep_recovery: true 
      };
      
      const startTime = Date.now();
      const result = await enrichCompanyDetails(entity.company, true, extraContext);
      const elapsed = Date.now() - startTime;
      
      let recovered = 0;
      
      for (const fact of verifiedFacts) {
        const field = fact.field;
        let predicted: any;
        
        switch (field) {
          case 'email': predicted = result.emails_list || (result.email ? [result.email] : []); break;
          case 'phone': predicted = result.phones_list || (result.phone ? [result.phone] : []); break;
          case 'website': predicted = result.website; break;
          case 'address': predicted = result.addresses || (result.address ? [{address: result.address}] : []); break;
          case 'fax': predicted = result.fax_numbers || []; break;
          case 'leaders': predicted = result.contact_persons?.length || result.decision_makers?.length || 0; break;
          case 'leadership': 
            const leaders = [...(result.contact_persons || []), ...(result.decision_makers || [])];
            predicted = leaders.map((p: any) => `${p.name} ${p.designation || ''}`.trim()).join('; ');
            break;
          default: predicted = result[field];
        }
        
        const matched = matchFact(field, predicted, fact.value);
        if (matched) {
          recovered++;
          console.log(`  ✓ ${field}: "${fact.value}"`);
        } else {
          console.log(`  ✗ ${field}: expected "${fact.value}", got "${JSON.stringify(predicted).slice(0, 100)}"`);
        }
      }
      
      totalRecovered += recovered;
      
      results.push({
        company: entity.company,
        country: entity.country,
        verified_total: verifiedFacts.length,
        verified_recovered: recovered,
        verified_missed: verifiedFacts.length - recovered,
        elapsed_ms: elapsed,
        quality_status: result.quality_status,
        emails_found: result.emails_list?.length || 0,
        phones_found: result.phones_list?.length || 0,
        persons_found: result.contact_persons?.length || 0,
        addresses_found: result.addresses?.length || 0,
      });
      
      console.log(`  Recovered: ${recovered}/${verifiedFacts.length} | Time: ${elapsed}ms | Quality: ${result.quality_status}`);
      
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
      results.push({
        company: entity.company,
        country: entity.country,
        error: e.message,
      });
    }
  }
  
  // Summary
  console.log('\n=== BENCHMARK SUMMARY ===');
  console.log(`Total VERIFIED facts: ${totalVerified}`);
  console.log(`Total recovered: ${totalRecovered}`);
  console.log(`Recall: ${((totalRecovered / totalVerified) * 100).toFixed(1)}%`);
  
  console.log('\n=== PER-ENTITY RESULTS ===');
  for (const r of results) {
    if (r.error) {
      console.log(`${r.company} (${r.country}): ERROR - ${r.error}`);
    } else {
      console.log(`${r.company} (${r.country}): ${r.verified_recovered}/${r.verified_total} | ${r.quality_status} | ${r.elapsed_ms}ms`);
    }
  }
  
  // Save results
  const outputPath = '.agent/reports/POST_V2_1_LIVE_CONTACT_RECOVERY_REPORT.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    truthset_hash: 'frozen-truthset-v2-expanded',
    total_verified: totalVerified,
    total_recovered: totalRecovered,
    recall_pct: (totalRecovered / totalVerified) * 100,
    results,
  }, null, 2));
  
  console.log(`\nResults saved to ${outputPath}`);
}

runBenchmark().catch(e => console.error(e));