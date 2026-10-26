
const path = require('node:path');
if (!process.env.LOCALAPPDATA) throw new Error('PROTOTYPE_LOCAL_STORAGE_UNAVAILABLE');
process.env.NODE_ENV = 'production';
process.env.EDGEVIEW_DATA_DIR = path.join(process.env.LOCALAPPDATA, 'EdgeViewPrototype', 'state');
process.env.EDGEVIEW_MONITORING_ENABLED = '0';
delete process.env.EDGEVIEW_CONFIG;
delete process.env.EDGEVIEW_V1_DATA_DIR;
delete process.env.EDGEVIEW_SQLITE_DB;
delete process.env.EDGEVIEW_JSON_DB;
delete process.env.EDGEVIEW_TEST_MODE;
delete process.env.EDGEVIEW_DEV_SERVER;
for (const key of Object.keys(process.env)) if (key.endsWith('_API_KEY')) delete process.env[key];
require(path.join(__dirname, 'dist', 'server.cjs'));
