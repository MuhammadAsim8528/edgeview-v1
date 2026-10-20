import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function generateSbom(destination, execute = options => spawnSync('npm sbom --omit=dev --package-lock-only --sbom-format=cyclonedx --sbom-type=application --offline', options)) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/API_KEY|SECRET|TOKEN|PASSWORD|COOKIE|AUTH|^EDGEVIEW_/i.test(key)));
  const result = execute({ cwd: root, env, shell: true, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('npm SBOM generation failed; no new inventory published.');
  const bom = JSON.parse(result.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  // npm may use the checkout directory as the display name. Validate canonical
  // package identity/version instead; do not rewrite the standard tool's output.
  if (manifest.name !== 'edgeview' || bom.bomFormat !== 'CycloneDX' || !Array.isArray(bom.components)
    || bom.metadata?.component?.purl !== `pkg:npm/edgeview@${manifest.version}` || bom.metadata?.component?.version !== manifest.version) throw new Error('npm returned an unexpected SBOM; no inventory published.');
  const temp = `${destination}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  let owned = false;
  try {
    const fd = fs.openSync(temp, 'wx'); owned = true;
    try { fs.writeFileSync(fd, JSON.stringify(bom, null, 2) + '\n'); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, destination);
  } finally { if (owned) fs.rmSync(temp, { force: true }); }
  return { components: bom.components.length, format: bom.bomFormat };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(generateSbom(path.resolve(root, '..', '..', 'outputs', 'EdgeView-V1-Windows.zip.sbom.cdx.json')))); }
  catch { console.error('Production dependency SBOM generation failed; inspect npm sbom locally.'); process.exitCode = 1; }
}
