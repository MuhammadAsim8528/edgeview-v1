import { spawn } from 'node:child_process';

const command = process.platform === 'win32' ? 'node_modules\\.bin\\tsx.cmd' : 'node_modules/.bin/tsx';
const child = spawn(command, ['server.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'development', EDGEVIEW_DEV_SERVER: '1' },
  stdio: 'inherit',
  shell: false,
});
child.on('exit', code => process.exit(code ?? 1));
