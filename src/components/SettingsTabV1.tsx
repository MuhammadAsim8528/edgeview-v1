import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Cpu, KeyRound, RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch';
import { SystemHealthPanel } from './SystemHealthPanel';
import { LogsViewerPanel } from './LogsViewerPanel';

interface SettingsTabProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  contacts?: any[];
}

type ProviderId = 'serper' | 'hunter' | 'nvidia' | 'groq';
type ProviderState = { key: string; configured: boolean; enabled: boolean; testing: boolean; result?: string; ok?: boolean };

const PROVIDERS: Array<{ id: ProviderId; name: string; role: string; icon: React.ReactNode }> = [
  { id: 'serper', name: 'Serper', role: 'Identity-anchored web search', icon: <Search className="h-4 w-4" /> },
  { id: 'hunter', name: 'Hunter', role: 'Domain email intelligence', icon: <KeyRound className="h-4 w-4" /> },
  { id: 'nvidia', name: 'NVIDIA NIM', role: 'AI query planning and extraction', icon: <Cpu className="h-4 w-4" /> },
  { id: 'groq', name: 'Groq', role: 'AI fallback for query planning and extraction', icon: <Cpu className="h-4 w-4" /> },
];

const initialProviders = (): Record<ProviderId, ProviderState> => ({
  serper: { key: '', configured: false, enabled: true, testing: false },
  hunter: { key: '', configured: false, enabled: true, testing: false },
  nvidia: { key: '', configured: false, enabled: true, testing: false },
  groq: { key: '', configured: false, enabled: true, testing: false },
});

export const SettingsTabV1: React.FC<SettingsTabProps> = ({ showToast, contacts = [] }) => {
  const [providers, setProviders] = useState(initialProviders);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nvidiaModel, setNvidiaModel] = useState('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  const [groqModel, setGroqModel] = useState('openai/gpt-oss-120b');
  const [primaryProvider, setPrimaryProvider] = useState<'NVIDIA' | 'GROQ'>('NVIDIA');

  const quality = useMemo(() => contacts.reduce((acc, item) => {
    const status = item.quality_status || (item.email || item.phone ? 'COMPLETE' : item.address || item.website ? 'PARTIAL' : 'PENDING');
    if (status === 'COMPLETE') acc.complete += 1;
    else if (status === 'PARTIAL') acc.partial += 1;
    else if (status === 'NOT_FOUND') acc.noPublic += 1;
    else if (status === 'FAILED') acc.failed += 1;
    return acc;
  }, { complete: 0, partial: 0, noPublic: 0, failed: 0 }), [contacts]);

  const patchProvider = (id: ProviderId, patch: Partial<ProviderState>) => {
    setProviders(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const load = async () => {
    setLoading(true);
    const { ok, data, error } = await safeFetchJson<any>('/api/settings');
    if (!ok || !data) {
      showToast(error || 'Could not load provider settings', 'error');
      setLoading(false);
      return;
    }
    setProviders(current => ({
      serper: { ...current.serper, configured: Boolean(data.has_serper_key), enabled: data.serper_enabled !== false },
      hunter: { ...current.hunter, configured: Boolean(data.has_hunter_key), enabled: data.hunter_enabled !== false },
      nvidia: { ...current.nvidia, configured: Boolean(data.has_nvidia_key), enabled: data.nvidia_enabled !== false },
      groq: { ...current.groq, configured: Boolean(data.has_groq_key), enabled: data.groq_enabled !== false },
    }));
    setNvidiaModel(data.nvidia_model || nvidiaModel);
    setGroqModel(data.groq_model || groqModel);
    setPrimaryProvider(data.primary_ai_provider === 'GROQ' ? 'GROQ' : 'NVIDIA');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const testProvider = async (id: ProviderId) => {
    patchProvider(id, { testing: true, result: undefined, ok: undefined });
    const model = id === 'nvidia' ? nvidiaModel : id === 'groq' ? groqModel : undefined;
    const { data, error } = await safeFetchJson<any>('/api/settings/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: id, key: providers[id].key, model }),
    });
    const success = Boolean(data?.success);
    const message = data?.message || error || 'Provider test failed';
    patchProvider(id, { testing: false, ok: success, result: message });
    showToast(`${PROVIDERS.find(p => p.id === id)?.name}: ${message}`, success ? 'success' : 'error');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { ok, data, error } = await safeFetchJson<any>('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serper_api_key: providers.serper.key, serper_enabled: providers.serper.enabled,
        hunter_api_key: providers.hunter.key, hunter_enabled: providers.hunter.enabled,
        nvidia_api_key: providers.nvidia.key, nvidia_enabled: providers.nvidia.enabled, nvidia_model: nvidiaModel,
        groq_api_key: providers.groq.key, groq_enabled: providers.groq.enabled, groq_model: groqModel,
        primary_ai_provider: primaryProvider,
      }),
    });
    setSaving(false);
    if (!ok || !data?.success) {
      showToast(data?.error || error || 'Could not save settings', 'error');
      return;
    }
    setProviders(current => ({
      serper: { ...current.serper, key: '', configured: Boolean(data.settings?.has_serper_key) },
      hunter: { ...current.hunter, key: '', configured: Boolean(data.settings?.has_hunter_key) },
      nvidia: { ...current.nvidia, key: '', configured: Boolean(data.settings?.has_nvidia_key) },
      groq: { ...current.groq, key: '', configured: Boolean(data.settings?.has_groq_key) },
    }));
    showToast('EdgeView V1 provider settings saved. Stored keys remain hidden.', 'success');
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="rounded-xl border border-[#262626] bg-[#1a1a1a] p-5">
      <div className="flex items-center gap-2 border-b border-[#2f2f2f] pb-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /><div><h2 className="font-semibold text-white">EdgeView V1 status</h2><p className="text-xs text-gray-400">Only the four providers in the V1 critical path are exposed here.</p></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
        {[
          ['Companies', contacts.length, 'text-white'], ['Complete', quality.complete, 'text-emerald-400'],
          ['Partial', quality.partial, 'text-amber-400'], ['No public contact', quality.noPublic, 'text-slate-300'], ['Failed', quality.failed, 'text-rose-400'],
        ].map(([label, value, color]) => <div key={String(label)} className="rounded-lg border border-[#333] bg-[#242424] p-3"><div className="text-gray-400">{label}</div><div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div></div>)}
      </div>
    </div>
    <SystemHealthPanel />
    <LogsViewerPanel />
    <form onSubmit={save} className="rounded-xl border border-[#262626] bg-[#1a1a1a] p-6">
      <div className="flex items-center justify-between border-b border-[#333] pb-4"><div><h2 className="font-semibold text-white">V1 provider configuration</h2><p className="mt-1 text-xs text-gray-400">Blank key fields preserve stored credentials. Provider tests make a small live request.</p></div><span className="rounded border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-[10px] text-emerald-300">Local storage</span></div>
      {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" />Loading settings…</div> : <div className="mt-5 space-y-4">
        <div className="rounded-lg border border-[#333] bg-[#222] p-4 text-xs"><div className="font-semibold text-white">Primary AI provider</div><div className="mt-3 flex gap-5">{(['NVIDIA','GROQ'] as const).map(id => <label key={id} className="flex items-center gap-2 text-gray-300"><input type="radio" checked={primaryProvider === id} onChange={() => setPrimaryProvider(id)} />{id === 'NVIDIA' ? 'NVIDIA NIM' : 'Groq'}</label>)}</div></div>
        {PROVIDERS.map(provider => {
          const state = providers[provider.id];
          return <section key={provider.id} className="rounded-lg border border-[#333] bg-[#222] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-2 text-white">{provider.icon}<div><div className="text-sm font-semibold">{provider.name}</div><div className="text-xs text-gray-400">{provider.role}</div></div></div><label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={state.enabled} onChange={e => patchProvider(provider.id, { enabled: e.target.checked })} />Enabled</label></div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="password" value={state.key} onChange={e => patchProvider(provider.id, { key: e.target.value })} placeholder={state.configured ? 'Configured — enter only to replace' : 'Enter API key'} className="min-w-0 flex-1 rounded border border-[#3b3b3b] bg-[#171717] px-3 py-2 text-xs text-white" /><button type="button" disabled={state.testing || !state.enabled} onClick={() => void testProvider(provider.id)} className="rounded border border-[#444] bg-[#303030] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{state.testing ? 'Testing…' : 'Test connection'}</button></div>
            {(provider.id === 'nvidia' || provider.id === 'groq') && <input value={provider.id === 'nvidia' ? nvidiaModel : groqModel} onChange={e => provider.id === 'nvidia' ? setNvidiaModel(e.target.value) : setGroqModel(e.target.value)} aria-label={`${provider.name} model`} className="mt-2 w-full rounded border border-[#3b3b3b] bg-[#171717] px-3 py-2 text-xs text-white" />}
            {state.result && <div className={`mt-2 flex items-center gap-2 text-xs ${state.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{state.ok && <CheckCircle2 className="h-3.5 w-3.5" />}{state.result}</div>}
          </section>;
        })}
        <div className="flex justify-end"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Save configuration'}</button></div>
      </div>}
    </form>
  </div>;
};
