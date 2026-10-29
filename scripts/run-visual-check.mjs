import path from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || '--compare';
if (process.argv.length > 3 || !['--compare', '--capture'].includes(mode)) throw new Error('Use --capture for unreviewed evidence or --compare for approved references.');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|SystemRoot|WINDIR|COMSPEC|USERPROFILE|TEMP|TMP|APPDATA|LOCALAPPDATA|PLAYWRIGHT_BROWSERS_PATH|CI)$/i.test(key)));
env.EDGEVIEW_VISUAL_CAPTURE = mode === '--capture' ? '1' : '0';
console.log(mode === '--capture' ? 'CAPTURE ONLY: screenshots are unreviewed; visual comparison NOT VERIFIED.' : 'COMPARE: missing or changed reviewed references fail.');
const result = spawnSync(process.execPath, [path.resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', path.resolve('playwright.visual.config.ts')],
  { cwd: process.cwd(), env, stdio: 'inherit', windowsHide: true });
if (result.error) console.error('Visual test runner could not start. No visual acceptance established.');
process.exit(result.status ?? 1);
