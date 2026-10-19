import { getSafeContentDisposition, getSafeAsciiHeaderValue } from '../utils/header_encoder';
import { isSafeExternalUrl } from '../research_director';
import { parseContentDispositionFilename } from '../../src/utils/exportValidator';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

console.log('--- RUNNING ENHANCED SECURITY & REGRESSION UNIT TESTS ---');

// 1. ASCII Filename
const res1 = getSafeContentDisposition('report.csv');
console.log('ASCII:', res1);
assert(res1.includes('filename="report.csv"'), 'ASCII fallback present');
assert(res1.includes("filename*=UTF-8''report.csv"), 'RFC 6266 present');

// 2. Unicode / Bullet Filename
const unicodeName = 'Company • Export Director – International Business.csv';
const res2 = getSafeContentDisposition(unicodeName);
console.log('Unicode/Bullet:', res2);
assert(!/[^\x20-\x7E]/.test(res2.split(';')[1]), 'Fallback filename is strictly ASCII');
assert(res2.includes("filename*=UTF-8''Company%20%E2%80%A2%20Export%20Director%20%E2%80%93%20International%20Business.csv"), 'Unicode percent encoded');

// 3. Accent (José García)
const res3 = getSafeContentDisposition('José García.csv');
console.log('José García:', res3);
assert(res3.includes("filename*=UTF-8''Jos%C3%A9%20Garc%C3%ADa.csv"), 'José García encoded correctly');

// 4. Apostrophe in Name (O'Connor.csv - RFC 8187 percent encoded)
const resApostrophe = getSafeContentDisposition("O'Connor.csv");
console.log("O'Connor:", resApostrophe);
assert(resApostrophe.includes("O%27Connor.csv"), "Apostrophe percent-encoded in filename*");
const parsedApostrophe = parseContentDispositionFilename(resApostrophe);
assert(parsedApostrophe === "O'Connor.csv", "Client parser accurately restores O'Connor.csv without string truncation");

// 5. SSRF Validation Security Tests
console.log('--- TESTING SSRF PROTECTION ---');
assert(!isSafeExternalUrl('http://localhost/admin'), 'Block localhost');
assert(!isSafeExternalUrl('http://127.0.0.1:8080/metrics'), 'Block 127.0.0.1');
assert(!isSafeExternalUrl('http://169.254.169.254/latest/meta-data/'), 'Block AWS/GCP Metadata IP');
assert(!isSafeExternalUrl('http://169.254.10.10/metadata'), 'Block the complete link-local range');
assert(!isSafeExternalUrl('http://10.0.0.5/internal'), 'Block 10.x private IP');
assert(!isSafeExternalUrl('http://192.168.1.1/router'), 'Block 192.168.x private IP');
assert(!isSafeExternalUrl('http://100.64.0.1/internal'), 'Block carrier-grade NAT range');
assert(!isSafeExternalUrl('http://[fe80::1]/internal'), 'Block IPv6 link-local range');
assert(!isSafeExternalUrl('file:///etc/passwd'), 'Block file:// scheme');
assert(isSafeExternalUrl('https://example.com/about-us'), 'Allow public https domain');
assert(isSafeExternalUrl('http://pharma-company.org/contact'), 'Allow public http domain');

// 6. Custom Header ASCII Sanitization
const customHeaderVal = getSafeAsciiHeaderValue(['PDF • failed', 'DOCX – failed']);
console.log('Custom Header Value:', customHeaderVal);
assert(!/[^\x20-\x7E]/.test(customHeaderVal), 'Custom header value is strictly ASCII');
assert(!customHeaderVal.includes('•'), 'Bullet removed from custom header');

console.log('✅ ALL ENHANCED SECURITY & REGRESSION TESTS PASSED SUCCESSFULLY.');
