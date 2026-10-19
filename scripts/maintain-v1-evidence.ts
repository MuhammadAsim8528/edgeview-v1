import path from 'node:path';
import { auditV1Evidence } from '../server/v1_evidence_maintenance';

const apply = process.argv.includes('--quarantine');
const directory = path.resolve(process.env.EDGEVIEW_V1_DATA_DIR || 'data/v1-runs');
console.log(JSON.stringify({ ...auditV1Evidence(directory, apply), peakRssMiB: process.resourceUsage().maxRSS / 1024 }, null, 2));
