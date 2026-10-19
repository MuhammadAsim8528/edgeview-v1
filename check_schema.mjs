import fs from 'fs';
import initSqlJs from 'sql.js';
const SQL = await initSqlJs();
const buf = fs.readFileSync('C:\\Users\\asimh\\antigravity\\Pharma-AI-File-Viewer-2026-08-13-3b80f\\edgeview.db');
const db = new SQL.Database(buf);
const result = db.exec('SELECT sql FROM sqlite_master WHERE type="table" AND name LIKE "research_%"');
console.log(JSON.stringify(result, null, 2));