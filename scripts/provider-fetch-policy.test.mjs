import assert from 'node:assert/strict';
import {ESLint} from 'eslint';

// Exercise the actual scoped lint config, not string matching rule names.
// This prevents common accidental bypasses; trusted code authors can still
// change policy, so lint is not presented as an attacker-proof sandbox.
const eslint=new ESLint({cwd:process.cwd()});
const forbidden=[
 'async function request(){return fetch("https://provider.test");}',
 'async function request(){return globalThis.fetch("https://provider.test");}',
 'async function request(){return globalThis["fetch"]("https://provider.test");}',
 'const request = fetch;',
 'const {fetch: request}=globalThis;',
 'const {"fetch": request}=globalThis;',
];
for(const filePath of ['server/v1_engine.ts','server/settings.ts','server/ai_providers.ts']){
 for(const code of forbidden){const [result]=await eslint.lintText(code,{filePath});assert.ok(result.messages.some(message=>['no-restricted-globals','no-restricted-syntax'].includes(message.ruleId)),`${filePath}: generic fetch syntax escaped policy: ${code}`);}
 const [allowed]=await eslint.lintText('async function request(){return safeFetchProviderRequest("https://provider.test",{timeoutMs:25000});}',{filePath});
 assert.equal(allowed.errorCount,0,'the existing hardened boundary stays available');
}
console.log('PASS actual scoped provider lint policy rejects raw/global/computed/aliased fetch and permits the hardened transport');
