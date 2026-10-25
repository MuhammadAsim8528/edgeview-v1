import { useEffect, useRef, useState } from 'react';
import { safeFetchJson } from '../utils/safeFetch';

export function DiagnosticsExportPanel() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const prepare = async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(null); setPreview(null);
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await safeFetchJson<any>('/api/diagnostics/support', {signal:controller.signal,cache:'no-store'});
      if (active.current !== controller) return;
      if (!result.ok || result.data?.format !== 'edgeview-support-v1') setError('Diagnostics could not be prepared. Check the backend and retry.');
      else setPreview(JSON.stringify(result.data,null,2));
    } finally { clearTimeout(timer); if(active.current===controller) {active.current=null;setLoading(false);} }
  };
  const download = () => {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([preview+'\n'],{type:'application/json'}));
    const link = document.createElement('a'); link.href=url;link.download='EdgeView-Diagnostics.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section aria-label="Export support diagnostics" className="rounded-xl border border-[#333333] bg-[#1a1a1a] p-4 space-y-3">
    <h4 className="text-xs font-semibold text-white">Support diagnostics</h4>
    <p className="text-xs text-gray-400">Preview version, installation ID, health and resource measurements before downloading. Credentials, company data, raw logs and file paths are excluded. Nothing is sent to support automatically.</p>
    <button onClick={prepare} disabled={loading} className="px-3 py-2 border border-gray-600 rounded text-xs text-white disabled:opacity-40">{loading?'Preparing diagnostics...':'Preview diagnostics'}</button>
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    {preview && <><pre aria-label="Diagnostics preview" className="max-h-72 overflow-auto text-xs text-gray-300 whitespace-pre-wrap">{preview}</pre><button onClick={download} className="px-3 py-2 border border-gray-600 rounded text-xs text-white">Download diagnostics</button></>}
  </section>;
}
