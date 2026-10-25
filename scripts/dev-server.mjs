import { spawn } from 'node:child_process';

// Node refuses to spawn a .cmd wrapper without a shell, so load tsx through this Node binary and
// let it resolve from the project's own node_modules; the same form npm run test:v1 already uses.
const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: 'development', EDGEVIEW_DEV_SERVER: '1' },
  stdio: 'inherit',
  shell: false,
});
child.on('exit', code => process.exit(code ?? 1));
