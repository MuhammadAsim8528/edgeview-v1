import { buildEntityScopedEvidence, factHasTargetLocalOwnership } from '../evidence_neighborhood';

console.log('=== MISSION 4: BREAK EVIDENCE NEIGHBORHOODS ===\n');

// Test A: Target company heading with other company in body
console.log('=== TEST A: Target company heading, other company in body ===');
const docA = `# TARGET COMPANY\n\nKOBACGT | phone B\nACME LTD | phone C`;
const resultA = buildEntityScopedEvidence(docA, 'https://example.com/page', 'TARGET COMPANY', '', false);
console.log('Blocks:');
resultA.blocks.forEach(b => {
  console.log(`  [${b.block_type}] target=${b.target_association} orgs=${b.organization_signals.join(', ')} heading="${b.nearby_heading}"`);
  console.log(`    text: ${b.text}`);
});
console.log(`Mixed entity page: ${resultA.mixed_entity_page}`);
console.log(`Extraction content:\n${resultA.extraction_content}`);
console.log(`Ownership of "phone B": ${factHasTargetLocalOwnership(resultA, 'phone B')}`);
console.log(`Ownership of "phone C": ${factHasTargetLocalOwnership(resultA, 'phone C')}`);

// Test B: Target company heading, contact info without company name
console.log('\n=== TEST B: Target company heading, contact info without company name ===');
const docB = `# TARGET COMPANY\n## Contact Information\n\nPhone X\nAddress Y`;
const resultB = buildEntityScopedEvidence(docB, 'https://example.com/page', 'TARGET COMPANY', '', false);
console.log('Blocks:');
resultB.blocks.forEach(b => {
  console.log(`  [${b.block_type}] target=${b.target_association} orgs=${b.organization_signals.join(', ')} heading="${b.nearby_heading}"`);
  console.log(`    text: ${b.text}`);
});
console.log(`Mixed entity page: ${resultB.mixed_entity_page}`);
console.log(`Extraction content:\n${resultB.extraction_content}`);
console.log(`Ownership of "Phone X": ${factHasTargetLocalOwnership(resultB, 'Phone X')}`);
console.log(`Ownership of "Address Y": ${factHasTargetLocalOwnership(resultB, 'Address Y')}`);

// Test C: Table with multiple companies
console.log('\n=== TEST C: Table with multiple companies ===');
const docC = `Company,Country,Address,Phone
TARGET COMPANY,Tanzania,Plot 10 Dar es Salaam,+255 700 111 222
OTHER COMPANY LTD,Kenya,Nairobi,+254 700 999 999`;
const resultC = buildEntityScopedEvidence(docC, 'https://registry.example/list.pdf', 'TARGET COMPANY', 'Tanzania', true);
console.log('Blocks:');
resultC.blocks.forEach(b => {
  console.log(`  [${b.block_type}] target=${b.target_association} country=${b.country_association.join(', ')} orgs=${b.organization_signals.join(', ')}`);
  console.log(`    text: ${b.text}`);
});
console.log(`Mixed entity page: ${resultC.mixed_entity_page}`);
console.log(`Extraction content:\n${resultC.extraction_content}`);
console.log(`Ownership of "+255 700 111 222": ${factHasTargetLocalOwnership(resultC, '+255 700 111 222')}`);
console.log(`Ownership of "+254 700 999 999": ${factHasTargetLocalOwnership(resultC, '+254 700 999 999')}`);

// Test D: Government page with regulator footer
console.log('\n=== TEST D: Government page with regulator footer ===');
const docD = `# TARGET COMPANY\n\nTARGET COMPANY is registered in Tanzania.\nLicense: 12345\n\n---\n\nTanzania Medicines and Medical Devices Authority\nEmail: info@tmda.go.tz\nPhone: +255 22 245 0512\nAddress: Plot 10, Block 19, Kariakoo`;
const resultD = buildEntityScopedEvidence(docD, 'https://tmda.go.tz/registry', 'TARGET COMPANY', 'Tanzania', false);
console.log('Blocks:');
resultD.blocks.forEach(b => {
  console.log(`  [${b.block_type}] target=${b.target_association} orgs=${b.organization_signals.join(', ')} heading="${b.nearby_heading}"`);
  console.log(`    text: ${b.text}`);
});
console.log(`Mixed entity page: ${resultD.mixed_entity_page}`);
console.log(`Extraction content:\n${resultD.extraction_content}`);
console.log(`Ownership of "info@tmda.go.tz": ${factHasTargetLocalOwnership(resultD, 'info@tmda.go.tz')}`);
console.log(`Ownership of "+255 22 245 0512": ${factHasTargetLocalOwnership(resultD, '+255 22 245 0512')}`);

// Test E: Partner page with partner contact details
console.log('\n=== TEST E: Partner page with partner contact details ===');
const docE = `# PARTNER COMPANY\n\nWe are proud to work with TARGET COMPANY as our distributor in Tanzania.\n\nContact us at:\nEmail: sales@partner.com\nPhone: +255 111 222 333\nAddress: Partner Building, Dar es Salaam`;
const resultE = buildEntityScopedEvidence(docE, 'https://partner.com/about', 'TARGET COMPANY', 'Tanzania', false);
console.log('Blocks:');
resultE.blocks.forEach(b => {
  console.log(`  [${b.block_type}] target=${b.target_association} orgs=${b.organization_signals.join(', ')} heading="${b.nearby_heading}"`);
  console.log(`    text: ${b.text}`);
});
console.log(`Mixed entity page: ${resultE.mixed_entity_page}`);
console.log(`Extraction content:\n${resultE.extraction_content}`);
console.log(`Ownership of "sales@partner.com": ${factHasTargetLocalOwnership(resultE, 'sales@partner.com')}`);
console.log(`Ownership of "+255 111 222 333": ${factHasTargetLocalOwnership(resultE, '+255 111 222 333')}`);

// Test F: PDF with dozens of organizations
console.log('\n=== TEST F: PDF with multiple organizations ===');
const docF = `Company,Country,Email,Phone
TARGET COMPANY,Tanzania,info@target.com,+255 111 111 111
OTHER CO LTD,Kenya,info@other.com,+254 222 222 222
THIRD LTD,Uganda,info@third.com,+256 333 333 333
FOURTH INC,Tanzania,info@fourth.com,+255 444 444 444`;
const resultF = buildEntityScopedEvidence(docF, 'https://registry.example/list.pdf', 'TARGET COMPANY', 'Tanzania', true);
console.log('Blocks:');
resultF.blocks.forEach(b => {
  console.log(`  [${b.block_type}] target=${b.target_association} country=${b.country_association.join(', ')} orgs=${b.organization_signals.join(', ')}`);
  console.log(`    text: ${b.text}`);
});
console.log(`Mixed entity page: ${resultF.mixed_entity_page}`);
console.log(`Extraction content:\n${resultF.extraction_content}`);
console.log(`Ownership of "info@target.com": ${factHasTargetLocalOwnership(resultF, 'info@target.com')}`);
console.log(`Ownership of "info@other.com": ${factHasTargetLocalOwnership(resultF, 'info@other.com')}`);
console.log(`Ownership of "info@fourth.com": ${factHasTargetLocalOwnership(resultF, 'info@fourth.com')}`);