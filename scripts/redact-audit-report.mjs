import fs from 'node:fs';
import path from 'node:path';

// Mechanical redaction of the known local audit artifact; never read config.
const file = path.resolve('EDGEVIEW_SECURITY_AUDIT_FULL.md');
const original = fs.readFileSync(file, 'utf8');
const patterns = [
  /\b(?:nvapi[-_]|gsk[-_]|sk-|tvly[-_]|apify_api_|fc-)[A-Za-z0-9_.-]{12,}/g,
  /\b[a-fA-F0-9]{32,64}\b/g,
  /\b[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}\b/g,
  /`[A-Za-z0-9_.-]{32,}`/g,
];
let redacted = original;
for (const pattern of patterns) redacted = redacted.replace(pattern, '[REDACTED_CREDENTIAL_OR_IDENTIFIER]');
fs.writeFileSync(file, redacted, { encoding: 'utf8', mode: 0o600 });
console.log(JSON.stringify({ report: path.basename(file), changed: redacted !== original, credentialValuesPrinted: false }));
