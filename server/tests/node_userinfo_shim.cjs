// Windows Node 24 can fail uv_os_get_passwd under memory pressure before tsx
// starts. Tests use only the username to derive an isolated temporary folder.
const os = require('node:os');
try {
  os.userInfo();
} catch (_) {
  os.userInfo = () => ({ username: 'edgeview-test', uid: -1, gid: -1, shell: null, homedir: process.cwd() });
}
