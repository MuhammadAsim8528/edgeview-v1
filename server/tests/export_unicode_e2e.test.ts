import { getSafeContentDisposition, getSafeAsciiHeaderValue } from '../utils/header_encoder';
import { parseContentDispositionFilename } from '../../src/utils/exportValidator';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`E2E Assertion Failed: ${msg}`);
  }
}

console.log('--- RUNNING END-TO-END UNICODE EXPORT TESTS ---');

const testCases = [
  { name: 'ASCII simple', original: 'Company_Report.csv' },
  { name: 'Bullet character (U+2022)', original: 'Company • Export Director – International Business.csv' },
  { name: 'Spanish Accents', original: 'José García.csv' },
  { name: 'En-dash and Bullet', original: 'Pharmaceuticals – International Division • Islamabad.pdf' },
  { name: 'Multilingual Urdu & Chinese', original: 'فارما کارپوریشن • 医药公司.docx' }
];

testCases.forEach((tc, idx) => {
  console.log(`[Test ${idx + 1}] ${tc.name}`);
  
  // 1. Server generates disposition header
  const headerValue = getSafeContentDisposition(tc.original);
  console.log('   Server Header:', headerValue);

  // 2. Validate ByteString safety (Must be 100% ASCII-range bytes only)
  for (let i = 0; i < headerValue.length; i++) {
    const code = headerValue.charCodeAt(i);
    assert(code <= 255, `Character at index ${i} ('${headerValue[i]}') code ${code} exceeds 255! ByteString violation!`);
    assert(code >= 32 && code <= 126, `Character at index ${i} ('${headerValue[i]}') code ${code} outside printable ASCII range!`);
  }

  // 3. Client receives header and parses original filename via parseContentDispositionFilename
  const parsedFilename = parseContentDispositionFilename(headerValue, 'csv');
  console.log('   Client Parsed Filename:', parsedFilename);

  // 4. Assert exact Unicode preservation on client
  assert(parsedFilename === tc.original, `Parsed filename '${parsedFilename}' does not match original '${tc.original}'`);
});

console.log('✅ ALL END-TO-END UNICODE EXPORT TESTS PASSED SUCCESSFULLY.');
