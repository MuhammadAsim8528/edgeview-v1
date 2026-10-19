import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Database, ExternalLink, FileCode2, RefreshCw, Search } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';

interface Timeline { at: string; stage: string; status: string; message: string; query?: string; provider?: string; latency_ms?: number; error?: string }
interface Result { id: string; raw_record_id: string; query: string; provider: string; rank: number; title: string; url: string; snippet: string; text?: string; markdown?: string; html?: string; links: string[]; metadata: Record<string, unknown>; search_latency_ms: number; scrape_latency_ms?: number; status: string; error?: string }
interface RawRecord { id: string; kind: string; provider: string; request: Record<string, unknown>; response?: unknown; failure?: { message: string; status?: number }; latency_ms: number; sha256: string }
interface Run { id: string; company_name: string; country: string; status: string; started_at: string; queries: string[]; results: Result[]; raw_records: RawRecord[]; timeline: Timeline[] }
interface RunSummary { id: string; company_name: string; country: string; status: string; started_at: string; query_count: number; result_count: number; raw_record_count: number; failure_count: number }

export const ResearchWorkspace: React.FC = () => {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('edgeview_v1_run_id') || sessionStorage.getItem('edgeview_v1_run_id') || '');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await safeFetchJson<{ runs: RunSummary[] }>('/api/v1/runs?limit=1000');
    if (ok && data?.runs) {
      setRuns(data.runs);
      const requested = localStorage.getItem('edgeview_v1_run_id');
      setSelectedId(current => requested && data.runs.some(r => r.id === requested) ? requested : current && data.runs.some(r => r.id === current) ? current : data.runs[0]?.id || '');
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = selectedId || runs[0]?.id;
    if (!id) { setRun(null); return; }
    void safeFetchJson<{ run: Run }>(`/api/v1/runs/${encodeURIComponent(id)}`).then(({ ok, data }) => {
      if (ok && data?.run) setRun(data.run);
    });
  }, [selectedId, runs]);
  useEffect(() => {
    if (selectedId) localStorage.setItem('edgeview_v1_run_id', selectedId);
  }, [selectedId]);
  if (loading) return <Empty text="Loading captured V1 runs…" />;
  if (!run) return <Empty text="No V1 run yet. Use Fetch Details on a company with a country." />;
  const failures = run.timeline.filter(item => item.status === 'failed').length;
  return <div className="space-y-4">
    <header className="rounded-xl border border-[#333] bg-[#171717] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[11px] uppercase tracking-[0.22em] text-emerald-400">EdgeView V1 · Lossless Retrieval</div><h2 className="mt-1 text-xl font-semibold text-white">{run.company_name}</h2><p className="text-sm text-[#9ca3af]">{run.country} · {run.id}</p></div><div className="flex items-center gap-2"><Badge status={run.status} /><button onClick={() => void load()} className="rounded border border-[#444] p-2 text-[#aaa] hover:text-white"><RefreshCw className="h-4 w-4" /></button></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4"><Metric label="Queries" value={run.queries.length} /><Metric label="Results" value={run.results.length} /><Metric label="Raw records" value={run.raw_records.length} /><Metric label="Failures retained" value={failures} /></div>
      {runs.length > 1 && <select className="mt-4 w-full rounded border border-[#3f3f46] bg-[#222] px-3 py-2 text-xs text-white" value={run.id} onChange={e => setSelectedId(e.target.value)}>{runs.map(item => <option key={item.id} value={item.id}>{item.company_name} · {item.country} · {item.status} · {new Date(item.started_at).toLocaleString()}</option>)}</select>}
    </header>
    <Panel icon={<Search className="h-4 w-4" />} title="Identity-anchored queries">{run.queries.map((query, i) => <div key={query} className="rounded border border-[#333] bg-[#202020] p-3 text-xs text-[#e4e4e7]"><span className="mr-2 font-mono text-emerald-400">{i + 1}</span>{query}</div>)}</Panel>
    <Panel icon={<Database className="h-4 w-4" />} title="All normalized provider results">
      {run.results.length === 0 ? <Empty text="No results. Inspect timeline and raw failures below." /> : run.results.map(result => {
        const open = expanded === result.id;
        return <article key={result.id} className="rounded-lg border border-[#333] bg-[#1d1d1d] p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] uppercase text-[#9ca3af]">{result.provider} · rank {result.rank} · {result.search_latency_ms}ms search{result.scrape_latency_ms !== undefined ? ` · ${result.scrape_latency_ms}ms scrape` : ''}</p><h3 className="mt-1 text-sm font-semibold text-white">{result.title || '(Untitled)'}</h3><p className="mt-1 break-all text-[11px] text-sky-400">{result.url}</p></div><Badge status={result.status} /></div><p className="mt-2 text-xs leading-5 text-[#c5c5c5]">{result.snippet || 'No snippet returned.'}</p>{result.error && <p className="mt-2 rounded bg-red-950/40 p-2 text-xs text-red-300">{result.error}</p>}<button onClick={() => setExpanded(open ? '' : result.id)} className="mt-3 text-xs text-emerald-400">{open ? 'Hide captured fields' : 'Show every captured field'}</button>{open && <div className="mt-3 space-y-3 border-t border-[#333] pt-3"><Field label="Query" value={result.query} /><Field label="Raw references" value={result.raw_record_id} /><Field label="Metadata" value={JSON.stringify(result.metadata, null, 2)} /><Field label={`Links (${result.links.length})`} value={result.links.join('\n')} /><Field label="Full text" value={result.text} /><Field label="Markdown" value={result.markdown} /><Field label="HTML" value={result.html} />{result.url && <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400">Open source <ExternalLink className="h-3 w-3" /></a>}</div>}</article>;
      })}
    </Panel>
    <div className="grid gap-4 lg:grid-cols-2"><Panel icon={<Clock className="h-4 w-4" />} title="Run timeline">{run.timeline.map((event, i) => <div key={`${event.at}-${i}`} className="border-b border-[#2b2b2b] py-2 last:border-0"><div className="flex justify-between gap-2"><span className="text-xs text-white">{event.message}</span><Badge status={event.status} /></div><p className="mt-1 text-[10px] text-[#71717a]">{new Date(event.at).toLocaleTimeString()} · {event.stage}{event.provider ? ` · ${event.provider}` : ''}{event.latency_ms !== undefined ? ` · ${event.latency_ms}ms` : ''}</p>{event.query && <p className="mt-1 text-[10px] text-[#a1a1aa]">{event.query}</p>}{event.error && <p className="mt-1 text-[10px] text-red-300">{event.error}</p>}</div>)}</Panel><Panel icon={<FileCode2 className="h-4 w-4" />} title="Immutable raw provider records">{run.raw_records.map(raw => <details key={raw.id} className="rounded border border-[#333] bg-[#202020] p-3"><summary className="cursor-pointer text-xs text-white">{raw.kind} · {raw.provider} · {raw.latency_ms}ms {raw.failure ? '· failure' : ''}</summary><p className="mt-2 break-all font-mono text-[9px] text-[#71717a]">SHA-256 {raw.sha256}</p><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[10px] text-[#d4d4d8]">{JSON.stringify(raw, null, 2)}</pre></details>)}</Panel></div>
  </div>;
};

const Panel: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => <section className="rounded-xl border border-[#333] bg-[#1a1a1a] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">{icon}{title}</div><div className="space-y-2">{children}</div></section>;
const Empty: React.FC<{ text: string }> = ({ text }) => <div className="rounded-xl border border-[#333] bg-[#1a1a1a] p-8 text-center text-sm text-[#9ca3af]">{text}</div>;
const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-lg border border-[#333] bg-[#202020] p-3"><p className="text-[10px] uppercase text-[#71717a]">{label}</p><p className="mt-1 font-mono text-lg text-white">{value}</p></div>;
const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) => <div><p className="mb-1 text-[10px] uppercase text-[#71717a]">{label}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-[#111] p-3 text-[10px] text-[#d4d4d8]">{value || 'Not returned by provider'}</pre></div>;
const Badge: React.FC<{ status: string }> = ({ status }) => { const good = ['COMPLETED', 'success'].includes(status); const bad = ['FAILED', 'failed'].includes(status); return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase ${good ? 'border-emerald-800 text-emerald-400' : bad ? 'border-red-900 text-red-300' : 'border-amber-900 text-amber-300'}`}>{good ? <CheckCircle2 className="h-3 w-3" /> : bad ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{status}</span>; };
