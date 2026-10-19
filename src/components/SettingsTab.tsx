import React, { useState, useEffect } from 'react';
import { safeFetchJson } from '../utils/safeFetch';
import { SystemHealthPanel } from './SystemHealthPanel';
import { LogsViewerPanel } from './LogsViewerPanel';
import { useEdgeViewRuntimeState } from '../hooks/useEdgeViewRuntimeState';
import {
  Settings,
  Key,
  Globe,
  Bot,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  Cpu,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Clock,
  Sparkles,
  ListFilter,
  Award,
  HelpCircle,
} from 'lucide-react';

interface SettingsTabProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  contacts?: any[];
}

interface AIModelItem {
  id: string;
  name: string;
  owned_by?: string;
  context_length?: number;
  active?: boolean;
}

const MASKED_KEY_CHARS = ['•', '*'];

// Retained for compatibility with older backends. Current backends never send
// secret-like values to the browser; configured state is represented separately.
const isMaskedKey = (value: string | undefined): boolean => {
  if (!value) return false;
  const s = String(value).trim();
  return MASKED_KEY_CHARS.some((c) => s.includes(c));
};

export const SettingsTab: React.FC<SettingsTabProps> = ({ showToast, contacts }) => {
  const { state: runtimeState, refresh: refreshRuntimeState } = useEdgeViewRuntimeState();

  // Serper
  const [serperKey, setSerperKey] = useState<string>('');
  const [showSerperKey, setShowSerperKey] = useState<boolean>(false);
  const [hasSerperKey, setHasSerperKey] = useState<boolean>(false);
  const [testingSerper, setTestingSerper] = useState<boolean>(false);
  const [serperTestResult, setSerperTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [serperEnabled, setSerperEnabled] = useState<boolean>(true);

  // Firecrawl
  const [firecrawlKey, setFirecrawlKey] = useState<string>('');
  const [showFirecrawlKey, setShowFirecrawlKey] = useState<boolean>(false);
  const [hasFirecrawlKey, setHasFirecrawlKey] = useState<boolean>(false);
  const [testingFirecrawl, setTestingFirecrawl] = useState<boolean>(false);
  const [firecrawlTestResult, setFirecrawlTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [firecrawlEnabled, setFirecrawlEnabled] = useState<boolean>(true);

  // Hunter
  const [hunterKey, setHunterKey] = useState<string>('');
  const [showHunterKey, setShowHunterKey] = useState<boolean>(false);
  const [hasHunterKey, setHasHunterKey] = useState<boolean>(false);
  const [testingHunter, setTestingHunter] = useState<boolean>(false);
  const [hunterTestResult, setHunterTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [hunterEnabled, setHunterEnabled] = useState<boolean>(true);

  // Tavily
  const [tavilyKey, setTavilyKey] = useState<string>('');
  const [showTavilyKey, setShowTavilyKey] = useState<boolean>(false);
  const [hasTavilyKey, setHasTavilyKey] = useState<boolean>(false);
  const [testingTavily, setTestingTavily] = useState<boolean>(false);
  const [tavilyTestResult, setTavilyTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [tavilyEnabled, setTavilyEnabled] = useState<boolean>(true);

  // Exa
  const [exaKey, setExaKey] = useState<string>('');
  const [showExaKey, setShowExaKey] = useState<boolean>(false);
  const [hasExaKey, setHasExaKey] = useState<boolean>(false);
  const [testingExa, setTestingExa] = useState<boolean>(false);
  const [exaTestResult, setExaTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [exaEnabled, setExaEnabled] = useState<boolean>(true);

  // Linkup
  const [linkupKey, setLinkupKey] = useState<string>('');
  const [showLinkupKey, setShowLinkupKey] = useState<boolean>(false);
  const [hasLinkupKey, setHasLinkupKey] = useState<boolean>(false);
  const [testingLinkup, setTestingLinkup] = useState<boolean>(false);
  const [linkupTestResult, setLinkupTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [linkupEnabled, setLinkupEnabled] = useState<boolean>(true);

  // Apify
  const [apifyKey, setApifyKey] = useState<string>('');
  const [showApifyKey, setShowApifyKey] = useState<boolean>(false);
  const [hasApifyKey, setHasApifyKey] = useState<boolean>(false);
  const [testingApify, setTestingApify] = useState<boolean>(false);
  const [apifyTestResult, setApifyTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [apifyEnabled, setApifyEnabled] = useState<boolean>(true);

  // Provider Metrics
  const [providerMetrics, setProviderMetrics] = useState<Record<string, any>>({});
  const [providerHealthReport, setProviderHealthReport] = useState<Record<string, any>>({});
  const fetchProviderMetrics = async () => {
    try {
      const { ok, data } = await safeFetchJson<any>('/api/governor/provider-metrics');
      if (ok && data && data.success) {
        setProviderMetrics(data.metrics || {});
        setProviderHealthReport(data.report || {});
      }
    } catch (e) {
      console.error('Error fetching provider metrics:', e);
    }
  };

  useEffect(() => {
    fetchProviderMetrics();
    const interval = setInterval(fetchProviderMetrics, 1500);
    return () => clearInterval(interval);
  }, []);

  // NVIDIA NIM
  const [nvidiaKey, setNvidiaKey] = useState<string>('');
  const [showNvidiaKey, setShowNvidiaKey] = useState<boolean>(false);
  const [hasNvidiaKey, setHasNvidiaKey] = useState<boolean>(false);
  const [nvidiaModel, setNvidiaModel] = useState<string>('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  const [nvidiaTemp, setNvidiaTemp] = useState<number>(0.7);
  const [nvidiaMaxTokens, setNvidiaMaxTokens] = useState<number>(1024);
  const [nvidiaFallback, setNvidiaFallback] = useState<string>('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
  const [nvidiaBaseUrl, setNvidiaBaseUrl] = useState<string>('');
  const [nvidiaReasoningMode, setNvidiaReasoningMode] = useState<'INSTRUCT' | 'THINKING'>('INSTRUCT');
  const [nvidiaEnabled, setNvidiaEnabled] = useState<boolean>(true);
  const [testingNvidia, setTestingNvidia] = useState<boolean>(false);
  const [nvidiaTestResult, setNvidiaTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Dynamic Models - NVIDIA
  const [nvidiaModels, setNvidiaModels] = useState<AIModelItem[]>([]);
  const [loadingNvidiaModels, setLoadingNvidiaModels] = useState<boolean>(false);
  const [nvidiaModelsError, setNvidiaModelsError] = useState<string | null>(null);
  const [nvidiaModelsLastUpdated, setNvidiaModelsLastUpdated] = useState<string | null>(null);

  // Groq
  const [groqKey, setGroqKey] = useState<string>('');
  const [showGroqKey, setShowGroqKey] = useState<boolean>(false);
  const [hasGroqKey, setHasGroqKey] = useState<boolean>(false);
  const [groqModel, setGroqModel] = useState<string>('openai/gpt-oss-120b');
  const [groqTemp, setGroqTemp] = useState<number>(0.7);
  const [groqMaxTokens, setGroqMaxTokens] = useState<number>(1024);
  const [groqFallback, setGroqFallback] = useState<string>('openai/gpt-oss-20b');
  const [testingGroq, setTestingGroq] = useState<boolean>(false);
  const [groqTestResult, setGroqTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [groqEnabled, setGroqEnabled] = useState<boolean>(true);

  // Dynamic Models - Groq
  const [groqModels, setGroqModels] = useState<AIModelItem[]>([]);
  const [loadingGroqModels, setLoadingGroqModels] = useState<boolean>(false);
  const [groqModelsError, setGroqModelsError] = useState<string | null>(null);
  const [groqModelsLastUpdated, setGroqModelsLastUpdated] = useState<string | null>(null);

  // General Settings
  const [primaryProvider, setPrimaryProvider] = useState<'NVIDIA' | 'GROQ' | 'GEMINI'>('NVIDIA');
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-3.6-flash');
  const [geminiEnabled, setGeminiEnabled] = useState<boolean>(true);
  const [testingGemini, setTestingGemini] = useState<boolean>(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Status
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [resettingSettings, setResettingSettings] = useState<boolean>(false);

  // Dynamic Model Discovery Fetcher
  const fetchModels = async (
    provider: 'nvidia' | 'groq',
    refresh: boolean = false,
    overrideKey?: string,
    overrideBaseUrl?: string,
    showSuccessToast: boolean = true
  ) => {
    const isNvidia = provider === 'nvidia';
    const setLoading = isNvidia ? setLoadingNvidiaModels : setLoadingGroqModels;
    const setModels = isNvidia ? setNvidiaModels : setGroqModels;
    const setError = isNvidia ? setNvidiaModelsError : setGroqModelsError;
    const setLastUpdated = isNvidia ? setNvidiaModelsLastUpdated : setGroqModelsLastUpdated;

    const keyToUse = isMaskedKey(overrideKey !== undefined ? overrideKey : (isNvidia ? nvidiaKey : groqKey))
      ? ''
      : (overrideKey !== undefined ? overrideKey : (isNvidia ? nvidiaKey : groqKey));
    const baseUrlToUse = overrideBaseUrl !== undefined ? overrideBaseUrl : nvidiaBaseUrl;

    setLoading(true);
    setError(null);

    try {
      const { ok, data, error } = await safeFetchJson<any>('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          key: keyToUse,
          baseUrl: baseUrlToUse,
          refresh,
        }),
      });

      if (ok && data && data.success && Array.isArray(data.models)) {
        setModels(data.models);
        setLastUpdated(data.last_updated || new Date().toISOString());
        setError(null);

        if (showSuccessToast) {
          showToast(`Models updated: ${data.models.length} available for ${provider.toUpperCase()}`, 'success');
        }

        const currentSelected = isNvidia ? nvidiaModel : groqModel;
        if (currentSelected && data.models.length > 0) {
          const exists = data.models.some((m: AIModelItem) => m.id === currentSelected);
          if (!exists) {
            showToast(`Selected ${provider.toUpperCase()} model '${currentSelected}' is no longer available. Please select a current model.`, 'warning');
          }
        }
      } else {
        const errMsg = data?.error || error || 'Failed to fetch model list';
        setError(errMsg);
        if (showSuccessToast) {
          showToast(`${provider.toUpperCase()} Models Error: ${errMsg}`, 'error');
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Network error fetching models';
      setError(msg);
      if (showSuccessToast) {
        showToast(`${provider.toUpperCase()} Models Error: ${msg}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (isoString: string | null) => {
    if (!isoString) return 'Not updated';
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diff < 10) return 'Just now';
      if (diff < 60) return `${diff}s ago`;
      const mins = Math.floor(diff / 60);
      if (mins < 60) return `${mins}m ago`;
      return `${Math.floor(mins / 60)}h ago`;
    } catch {
      return 'Recently';
    }
  };

  // Load current settings from backend
  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const { ok, data, error } = await safeFetchJson<any>('/api/settings');
      if (ok && data) {
        setSerperKey('');
        setFirecrawlKey('');
        setHasSerperKey(Boolean(data.has_serper_key));
        setHasFirecrawlKey(Boolean(data.has_firecrawl_key));
        setHasGeminiKey(Boolean(data.has_gemini_key));
        setGeminiKey('');
        setGeminiModel(data.gemini_model || 'gemini-3.6-flash');

        setSerperEnabled(data.serper_enabled !== undefined ? Boolean(data.serper_enabled) : true);
        setFirecrawlEnabled(data.firecrawl_enabled !== undefined ? Boolean(data.firecrawl_enabled) : true);

        setHunterKey('');
        setHasHunterKey(Boolean(data.has_hunter_key));
        setHunterEnabled(data.hunter_enabled !== undefined ? Boolean(data.hunter_enabled) : true);

        setTavilyKey('');
        setHasTavilyKey(Boolean(data.has_tavily_key));
        setTavilyEnabled(data.tavily_enabled !== undefined ? Boolean(data.tavily_enabled) : true);

        setExaKey('');
        setHasExaKey(Boolean(data.has_exa_key));
        setExaEnabled(data.exa_enabled !== undefined ? Boolean(data.exa_enabled) : true);

        setLinkupKey('');
        setHasLinkupKey(Boolean(data.has_linkup_key));
        setLinkupEnabled(data.linkup_enabled !== undefined ? Boolean(data.linkup_enabled) : true);

        setApifyKey('');
        setHasApifyKey(Boolean(data.has_apify_key));
        setApifyEnabled(data.apify_enabled !== undefined ? Boolean(data.apify_enabled) : true);

        setNvidiaKey('');
        setNvidiaModel(data.nvidia_model || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
        setNvidiaTemp(typeof data.nvidia_temperature === 'number' ? data.nvidia_temperature : 0.7);
        setNvidiaMaxTokens(data.nvidia_max_tokens || 1024);
        setNvidiaFallback(data.nvidia_fallback_model || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
        setNvidiaBaseUrl(data.nvidia_base_url || '');
        setNvidiaReasoningMode(data.nvidia_reasoning_mode === 'THINKING' ? 'THINKING' : 'INSTRUCT');
        setNvidiaEnabled(data.nvidia_enabled !== false);
        setHasNvidiaKey(Boolean(data.has_nvidia_key));

        setGroqKey('');
        setGroqModel(data.groq_model || 'openai/gpt-oss-120b');
        setGroqTemp(typeof data.groq_temperature === 'number' ? data.groq_temperature : 0.7);
        setGroqMaxTokens(data.groq_max_tokens || 1024);
        setGroqFallback(data.groq_fallback_model || 'openai/gpt-oss-20b');
        setHasGroqKey(Boolean(data.has_groq_key));
        setGroqEnabled(data.groq_enabled !== false);
        setGeminiEnabled(data.gemini_enabled !== false);

        if (data.primary_ai_provider === 'GEMINI') {
          setPrimaryProvider('GEMINI');
        } else if (data.primary_ai_provider === 'GROQ') {
          setPrimaryProvider('GROQ');
        } else {
          setPrimaryProvider('NVIDIA');
        }

        // Trigger background model discovery if API keys are available
        if (data.has_nvidia_key) {
          fetchModels('nvidia', false, '', data.nvidia_base_url, false);
        }
        if (data.has_groq_key) {
          fetchModels('groq', false, '', undefined, false);
        }
      } else {
        showToast(error || 'Failed to load settings', 'error');
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      showToast('Failed to load current API key settings', 'error');
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingSettings(true);
      const payload = {
        serper_api_key: serperKey,
        serper_enabled: serperEnabled,
        firecrawl_api_key: firecrawlKey,
        firecrawl_enabled: firecrawlEnabled,
        hunter_api_key: hunterKey,
        hunter_enabled: hunterEnabled,
        tavily_api_key: tavilyKey,
        tavily_enabled: tavilyEnabled,
        exa_api_key: exaKey,
        exa_enabled: exaEnabled,
        linkup_api_key: linkupKey,
        linkup_enabled: linkupEnabled,
        apify_api_key: apifyKey,
        apify_enabled: apifyEnabled,
        nvidia_api_key: nvidiaKey,
        nvidia_model: nvidiaModel,
        nvidia_temperature: Number(nvidiaTemp),
        nvidia_max_tokens: Number(nvidiaMaxTokens),
        nvidia_fallback_model: nvidiaFallback,
        nvidia_base_url: nvidiaBaseUrl,
        nvidia_reasoning_mode: nvidiaReasoningMode,
        nvidia_enabled: nvidiaEnabled,
        groq_api_key: groqKey,
        groq_model: groqModel,
        groq_temperature: Number(groqTemp),
        groq_max_tokens: Number(groqMaxTokens),
        groq_fallback_model: groqFallback,
        groq_enabled: groqEnabled,
        gemini_model: geminiModel,
        gemini_api_key: geminiKey,
        gemini_enabled: geminiEnabled,
        primary_ai_provider: primaryProvider,
      };

      const { ok, data, error } = await safeFetchJson<any>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (ok && data && data.success) {
        const saved = data.settings || {};
        setHasSerperKey(Boolean(saved.has_serper_key));
        setHasFirecrawlKey(Boolean(saved.has_firecrawl_key));
        setHasHunterKey(Boolean(saved.has_hunter_key));
        setHasTavilyKey(Boolean(saved.has_tavily_key));
        setHasExaKey(Boolean(saved.has_exa_key));
        setHasLinkupKey(Boolean(saved.has_linkup_key));
        setHasApifyKey(Boolean(saved.has_apify_key));
        setHasNvidiaKey(Boolean(saved.has_nvidia_key));
        setHasGroqKey(Boolean(saved.has_groq_key));
        setHasGeminiKey(Boolean(saved.has_gemini_key));
        setSerperKey('');
        setFirecrawlKey('');
        setHunterKey('');
        setTavilyKey('');
        setExaKey('');
        setLinkupKey('');
        setApifyKey('');
        setNvidiaKey('');
        setGroqKey('');
        setGeminiKey('');
        showToast('Settings saved and activated. Stored keys remain hidden.', 'success');
        await refreshRuntimeState();
      } else {
        throw new Error(data?.error || error || 'Failed to save settings');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error saving settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Reset Settings
  const handleResetSettings = async () => {
    if (!window.confirm('Are you sure you want to reset all API settings to defaults?')) return;
    try {
      setResettingSettings(true);
      const { ok, data, error } = await safeFetchJson<any>('/api/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET_SETTINGS' }),
      });
      if (ok && data && data.success) {
        showToast('Settings reset to defaults successfully', 'info');
        await loadSettings();
        await refreshRuntimeState();
      } else {
        throw new Error(data?.error || error || 'Failed to reset settings');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error resetting settings', 'error');
    } finally {
      setResettingSettings(false);
    }
  };

  // Test Functions
  const handleTestService = async (
    service: 'serper' | 'firecrawl' | 'nvidia' | 'groq' | 'gemini' | 'hunter' | 'tavily' | 'exa' | 'linkup' | 'apify',
    setTesting: React.Dispatch<React.SetStateAction<boolean>>,
    setResult: React.Dispatch<React.SetStateAction<{ success?: boolean; message?: string } | null>>,
    keyVal: string,
    modelVal?: string,
    urlVal?: string
  ) => {
    try {
      setTesting(true);
      setResult(null);
      const { data, error } = await safeFetchJson<any>('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, key: isMaskedKey(keyVal) ? '' : keyVal, model: modelVal, baseUrl: urlVal }),
      });
      const res = data || { success: false, message: error || 'Test failed' };
      setResult(res);
      if (res.success) {
        showToast(`${service.toUpperCase()} connection test successful!`, 'success');
      } else {
        showToast(`${service.toUpperCase()} Test Failed: ${res.message}`, 'error');
      }
      await refreshRuntimeState();
    } catch (err: any) {
      setResult({ success: false, message: err?.message || 'Test request failed' });
      showToast(`Failed to connect to ${service.toUpperCase()} API`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const list = contacts || [];
  const qualityCounts = list.reduce(
    (acc, c) => {
      const q = c.quality_status || (c.email || c.phone ? 'COMPLETE' : (c as any).address || (c as any).website ? 'PARTIAL' : 'PENDING');
      if (q === 'COMPLETE') acc.complete++;
      else if (q === 'PARTIAL') acc.partial++;
      else if (q === 'NOT_FOUND') acc.notFound++;
      else if (q === 'FAILED') acc.failed++;
      else acc.pending++;
      return acc;
    },
    { complete: 0, partial: 0, notFound: 0, failed: 0, pending: 0 }
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Enrichment Quality Status Dashboard (Relocated to Settings per architecture hardening spec) */}
      <div className="p-5 bg-[#1a1a1a] rounded-xl border border-[#262626] space-y-4 shadow-md">
        <div className="flex items-center space-x-2 border-b border-[#262626] pb-3">
          <Award className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Enrichment Quality Status Dashboard</h3>
            <p className="text-[11px] text-gray-400">Aggregated database status of enriched company leads and multi-agent contact intelligence.</p>
          </div>
        </div>

        {/* Status Pill Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-[#262626] rounded-lg border border-[#333333] flex flex-col justify-between h-16">
            <span className="text-gray-400 font-medium">Total Companies</span>
            <span className="font-bold font-mono text-lg text-white leading-none">{list.length}</span>
          </div>

          <div className="p-3 bg-[#262626] rounded-lg border border-emerald-500/20 flex flex-col justify-between h-16">
            <span className="text-emerald-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />
              <span>Complete</span>
            </span>
            <span className="font-bold font-mono text-lg text-emerald-400 leading-none">{qualityCounts.complete}</span>
          </div>

          <div className="p-3 bg-[#262626] rounded-lg border border-amber-500/20 flex flex-col justify-between h-16">
            <span className="text-amber-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />
              <span>Partial</span>
            </span>
            <span className="font-bold font-mono text-lg text-amber-400 leading-none">{qualityCounts.partial}</span>
          </div>

          <div className="p-3 bg-[#262626] rounded-lg border border-slate-500/20 flex flex-col justify-between h-16">
            <span className="text-slate-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1" />
              <span>No Public Contact</span>
            </span>
            <span className="font-bold font-mono text-lg text-slate-400 leading-none">{qualityCounts.notFound}</span>
          </div>

          <div className="p-3 bg-[#262626] rounded-lg border border-red-500/20 flex flex-col justify-between h-16">
            <span className="text-red-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />
              <span>Failed</span>
            </span>
            <span className="font-bold font-mono text-lg text-red-400 leading-none">{qualityCounts.failed}</span>
          </div>
        </div>
      </div>

      {/* System API Health & Usage Panel */}
      <SystemHealthPanel />

      {/* Technical Event & Activity Logs */}
      <LogsViewerPanel />

      {/* Settings Header Card */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#333333] pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center text-[#10b981]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                System & API Key Settings
              </h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                Configure the EdgeView V1 providers: Serper, Hunter, NVIDIA NIM, and Groq.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs bg-[#262626] border border-[#333333] px-3 py-1.5 rounded-lg text-gray-300 font-mono">
            <ShieldCheck className="w-4 h-4 text-[#10b981]" />
            <span>Storage: config.json & SQLite</span>
          </div>
        </div>

        {loadingSettings ? (
          <div className="py-12 text-center text-xs text-gray-400 flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#10b981]" />
            <span>Loading active key configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="pt-6 space-y-6">

            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-5 flex items-start space-x-3.5 text-xs text-white">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-3 flex-1">
                  <span className="font-bold text-white block">Google AI Studio (Gemini Engine {hasGeminiKey ? 'Configured' : 'Not Configured'})</span>
                  <span className="text-gray-300 block leading-relaxed">
                    Stored credentials remain hidden. Leave the field blank to keep the current key, or enter a new key to replace it.
                  </span>
                  <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                    <input type="password" value={geminiKey} onChange={(event) => setGeminiKey(event.target.value)} placeholder={hasGeminiKey ? 'Stored securely; enter a replacement only' : 'Enter Gemini API key'} className="flex-1 bg-[#171717] border border-[#3a3a3a] rounded-lg px-3 py-2 text-xs text-white font-mono" />
                    <button type="button" onClick={() => handleTestService('gemini', setTestingGemini, setGeminiTestResult, geminiKey, geminiModel)} disabled={testingGemini} className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444]">
                      {testingGemini ? 'Testing...' : 'Test Gemini'}
                    </button>
                  </div>
                  {geminiTestResult && <span className={geminiTestResult.success ? 'text-emerald-400 block' : 'text-rose-300 block'}>{geminiTestResult.message}</span>}
                  <label className="block max-w-xl">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1">Gemini model used for new runs</span>
                    <input
                      value={geminiModel}
                      onChange={(event) => setGeminiModel(event.target.value)}
                      className="w-full bg-[#171717] border border-[#3a3a3a] rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </label>
                </div>
            </div>
            
            {/* Primary AI Provider Choice */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-3">
              <div className="flex items-center space-x-2 text-white">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Primary AI Provider Selection</span>
              </div>
              <p className="text-xs text-gray-400">
                Choose which AI provider to attempt first for query optimization and contact extraction.
              </p>
              <div className="flex items-center space-x-6 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="primaryProvider"
                    value="NVIDIA"
                    checked={primaryProvider === 'NVIDIA'}
                    onChange={() => setPrimaryProvider('NVIDIA')}
                    disabled={!nvidiaEnabled}
                    className="w-4 h-4 text-emerald-500 bg-[#1a1a1a] border-[#404040]"
                  />
                  <span className="text-xs text-white font-medium">NVIDIA NIM</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="primaryProvider"
                    value="GROQ"
                    checked={primaryProvider === 'GROQ'}
                    onChange={() => setPrimaryProvider('GROQ')}
                    disabled={!groqEnabled}
                    className="w-4 h-4 text-emerald-500 bg-[#1a1a1a] border-[#404040]"
                  />
                  <span className="text-xs text-white font-medium">Groq</span>
                </label>
                {hasGeminiKey && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="primaryProvider"
                      value="GEMINI"
                      checked={primaryProvider === 'GEMINI'}
                      onChange={() => setPrimaryProvider('GEMINI')}
                      disabled={!geminiEnabled}
                      className="w-4 h-4 text-emerald-500 bg-[#1a1a1a] border-[#404040]"
                    />
                    <span className="text-xs text-white font-medium">Google AI Studio (Gemini)</span>
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-4 border-t border-[#333333] pt-3">
                {[
                  ['NVIDIA enabled', nvidiaEnabled, setNvidiaEnabled],
                  ['Groq enabled', groqEnabled, setGroqEnabled],
                  ['Gemini enabled', geminiEnabled, setGeminiEnabled],
                ].map(([label, enabled, setter]) => (
                  <label key={String(label)} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(enabled)}
                      onChange={(event) => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span>{String(label)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 1. NVIDIA NIM Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">NVIDIA NIM Microservices</span>
                  <span className="text-[10px] text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                    AI LLM & Extraction
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  {runtimeState.providers.nvidia?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.nvidia?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.nvidia?.status === 'healthy' ? 'Verified Healthy' : 'Configured (Unverified)'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* Key */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNvidiaKey ? 'text' : 'password'}
                      value={nvidiaKey}
                      onChange={(e) => setNvidiaKey(e.target.value)}
                      placeholder="Enter NVIDIA NIM API Key (e.g. nvapi-...)"
                      className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNvidiaKey(!showNvidiaKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showNvidiaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestService('nvidia', setTestingNvidia, setNvidiaTestResult, nvidiaKey, nvidiaModel, nvidiaBaseUrl)}
                    disabled={testingNvidia}
                    className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                  >
                    {testingNvidia ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Test NVIDIA</span>
                  </button>
                </div>

                {/* Dynamic Model Selector & Refresh */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-gray-300 font-medium flex items-center space-x-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
                      <span>NVIDIA Model (Dynamic Discovery):</span>
                    </label>

                    <div className="flex items-center space-x-3 text-[10px] text-gray-400 font-mono">
                      <span>{loadingNvidiaModels ? 'Discovering models...' : `${nvidiaModels.length} models available`}</span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>{formatTimeAgo(nvidiaModelsLastUpdated)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={nvidiaModel}
                        onChange={(e) => setNvidiaModel(e.target.value)}
                        disabled={loadingNvidiaModels}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {loadingNvidiaModels ? (
                          <option value={nvidiaModel}>Loading models from NVIDIA API...</option>
                        ) : nvidiaModels.length > 0 ? (
                          <>
                            {!nvidiaModels.some((m) => m.id === nvidiaModel) && (
                              <option value={nvidiaModel} disabled>
                                ⚠️ {nvidiaModel} (Retired / Unavailable)
                              </option>
                            )}
                            {nvidiaModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.id} {m.owned_by ? `(${m.owned_by})` : ''} {m.context_length ? `• ${Math.round(m.context_length / 1024)}k ctx` : ''}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value={nvidiaModel}>{nvidiaModel} (Default / Enter Key & Click Refresh)</option>
                        )}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchModels('nvidia', true)}
                      disabled={loadingNvidiaModels}
                      className="px-3 py-2 rounded-lg bg-[#10b981]/15 hover:bg-[#10b981]/25 disabled:opacity-50 text-emerald-400 border border-[#10b981]/30 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingNvidiaModels ? 'animate-spin' : ''}`} />
                      <span>{loadingNvidiaModels ? 'Refreshing...' : 'Refresh Models'}</span>
                    </button>
                  </div>

                  {/* Unavailable Model Alert Banner */}
                  {nvidiaModels.length > 0 && !nvidiaModels.some((m) => m.id === nvidiaModel) && (
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Selected model '<strong>{nvidiaModel}</strong>' is no longer available from NVIDIA NIM API. Please select an active model.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNvidiaModel(nvidiaModels[0].id)}
                        className="px-2 py-1 rounded bg-amber-800/50 hover:bg-amber-700/60 text-white text-[11px] font-medium whitespace-nowrap"
                      >
                        Select Top Model
                      </button>
                    </div>
                  )}
                </div>

                {/* Fallback Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">Fallback Model:</label>
                    {nvidiaModels.length > 0 ? (
                      <select
                        value={nvidiaFallback}
                        onChange={(e) => setNvidiaFallback(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                      >
                        {!nvidiaModels.some((m) => m.id === nvidiaFallback) && (
                          <option value={nvidiaFallback}>{nvidiaFallback} (Custom)</option>
                        )}
                        {nvidiaModels.map((m) => (
                          <option key={`fb-${m.id}`} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={nvidiaFallback}
                        onChange={(e) => setNvidiaFallback(e.target.value)}
                         placeholder="Select an active NVIDIA fallback model"
                        className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">Custom Base URL (Optional):</label>
                    <input
                      type="text"
                      value={nvidiaBaseUrl}
                      onChange={(e) => setNvidiaBaseUrl(e.target.value)}
                      placeholder="Default: https://integrate.api.nvidia.com/v1"
                      className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Request profile, temperature & max tokens */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">Nano Omni Request Profile:</label>
                    <select
                      value={nvidiaReasoningMode}
                      onChange={(event) => setNvidiaReasoningMode(event.target.value === 'THINKING' ? 'THINKING' : 'INSTRUCT')}
                      className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                    >
                      <option value="INSTRUCT">INSTRUCT (thinking disabled)</option>
                      <option value="THINKING">THINKING (thinking enabled)</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>Temperature: {nvidiaTemp}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={nvidiaTemp}
                      onChange={(e) => setNvidiaTemp(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">Max Tokens:</label>
                    <input
                      type="number"
                      min="128"
                      max="4096"
                      value={nvidiaMaxTokens}
                      onChange={(e) => setNvidiaMaxTokens(parseInt(e.target.value) || 1024)}
                      className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {nvidiaTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${nvidiaTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {nvidiaTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{nvidiaTestResult.message}</span>
                </div>
              )}

              {/* Real-time backend resource consumption & health message */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="text-gray-300 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Cumulative Usage:</span>
                  <span className="font-bold font-mono text-white">{runtimeState.resources.nvidia || 0}</span>
                  <span className="text-gray-400">requests</span>
                </div>
                {runtimeState.providers.nvidia?.message && (
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="text-gray-500">Verification:</span>
                    <span className={runtimeState.providers.nvidia?.status === 'healthy' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                      {runtimeState.providers.nvidia.message}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Health Telemetry from ProviderHealthManager */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerHealthReport.nvidia?.circuitBreakerState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerHealthReport.nvidia?.circuitBreakerState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerHealthReport.nvidia?.circuitBreakerState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">API Success / Fail</span>
                  <span className="font-semibold text-white mt-0.5 font-mono flex items-center space-x-1">
                    <span className="text-[#10b981]">{providerHealthReport.nvidia?.successCount || 0}</span>
                    <span className="text-gray-500">/</span>
                    <span className={providerHealthReport.nvidia?.failureCount > 0 ? 'text-rose-400' : 'text-gray-400'}>
                      {providerHealthReport.nvidia?.failureCount || 0}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerHealthReport.nvidia?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerHealthReport.nvidia?.requestCount > 0 
                      ? `${Math.round((providerHealthReport.nvidia.successCount / providerHealthReport.nvidia.requestCount) * 100)}%`
                      : '100%'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Groq Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-bold text-white">Groq LPU Acceleration</span>
                  <span className="text-[10px] text-orange-400/90 bg-orange-950/60 border border-orange-800/60 px-2 py-0.5 rounded font-mono">
                    High-Speed Fallback
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  {runtimeState.providers.groq?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.groq?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.groq?.status === 'healthy' ? 'Verified Healthy' : 'Configured (Unverified)'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* Key */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showGroqKey ? 'text' : 'password'}
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      placeholder="Enter Groq API Key (e.g. gsk_...)"
                      className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGroqKey(!showGroqKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTestService('groq', setTestingGroq, setGroqTestResult, groqKey, groqModel)}
                    disabled={testingGroq}
                    className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                  >
                    {testingGroq ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-orange-400" />}
                    <span>Test Groq</span>
                  </button>
                </div>

                {/* Dynamic Model Selector & Refresh */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-gray-300 font-medium flex items-center space-x-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-orange-400" />
                      <span>Groq Model (Dynamic Discovery):</span>
                    </label>

                    <div className="flex items-center space-x-3 text-[10px] text-gray-400 font-mono">
                      <span>{loadingGroqModels ? 'Discovering models...' : `${groqModels.length} models available`}</span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>{formatTimeAgo(groqModelsLastUpdated)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={groqModel}
                        onChange={(e) => setGroqModel(e.target.value)}
                        disabled={loadingGroqModels}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {loadingGroqModels ? (
                          <option value={groqModel}>Loading models from Groq API...</option>
                        ) : groqModels.length > 0 ? (
                          <>
                            {!groqModels.some((m) => m.id === groqModel) && (
                              <option value={groqModel} disabled>
                                ⚠️ {groqModel} (Retired / Unavailable)
                              </option>
                            )}
                            {groqModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.id} {m.owned_by ? `(${m.owned_by})` : ''} {m.context_length ? `• ${Math.round(m.context_length / 1024)}k ctx` : ''}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value={groqModel}>{groqModel} (Default / Enter Key & Click Refresh)</option>
                        )}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchModels('groq', true)}
                      disabled={loadingGroqModels}
                      className="px-3 py-2 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-50 text-orange-400 border border-orange-500/30 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingGroqModels ? 'animate-spin' : ''}`} />
                      <span>{loadingGroqModels ? 'Refreshing...' : 'Refresh Models'}</span>
                    </button>
                  </div>

                  {/* Unavailable Model Alert Banner */}
                  {groqModels.length > 0 && !groqModels.some((m) => m.id === groqModel) && (
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Selected model '<strong>{groqModel}</strong>' is no longer available from Groq API. Please select an active model.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGroqModel(groqModels[0].id)}
                        className="px-2 py-1 rounded bg-amber-800/50 hover:bg-amber-700/60 text-white text-[11px] font-medium whitespace-nowrap"
                      >
                        Select Top Model
                      </button>
                    </div>
                  )}
                </div>

                {/* Fallback Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">Fallback Model:</label>
                    {groqModels.length > 0 ? (
                      <select
                        value={groqFallback}
                        onChange={(e) => setGroqFallback(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                      >
                        {!groqModels.some((m) => m.id === groqFallback) && (
                          <option value={groqFallback}>{groqFallback} (Custom)</option>
                        )}
                        {groqModels.map((m) => (
                          <option key={`gfb-${m.id}`} value={m.id}>
                            {m.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={groqFallback}
                        onChange={(e) => setGroqFallback(e.target.value)}
                        placeholder="e.g. mixtral-8x7b-32768"
                        className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Temperature & Max Tokens */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>Temperature: {groqTemp}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={groqTemp}
                      onChange={(e) => setGroqTemp(parseFloat(e.target.value))}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">Max Tokens:</label>
                    <input
                      type="number"
                      min="128"
                      max="4096"
                      value={groqMaxTokens}
                      onChange={(e) => setGroqMaxTokens(parseInt(e.target.value) || 1024)}
                      className="w-full px-3 py-1.5 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {groqTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${groqTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {groqTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{groqTestResult.message}</span>
                </div>
              )}

              {/* Real-time backend resource consumption & health message */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="text-gray-300 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span>Cumulative Usage:</span>
                  <span className="font-bold font-mono text-white">{runtimeState.resources.groq || 0}</span>
                  <span className="text-gray-400">requests</span>
                </div>
                {runtimeState.providers.groq?.message && (
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="text-gray-500">Verification:</span>
                    <span className={runtimeState.providers.groq?.status === 'healthy' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                      {runtimeState.providers.groq.message}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Health Telemetry from ProviderHealthManager */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerHealthReport.groq?.circuitBreakerState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerHealthReport.groq?.circuitBreakerState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerHealthReport.groq?.circuitBreakerState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">API Success / Fail</span>
                  <span className="font-semibold text-white mt-0.5 font-mono flex items-center space-x-1">
                    <span className="text-[#10b981]">{providerHealthReport.groq?.successCount || 0}</span>
                    <span className="text-gray-500">/</span>
                    <span className={providerHealthReport.groq?.failureCount > 0 ? 'text-rose-400' : 'text-gray-400'}>
                      {providerHealthReport.groq?.failureCount || 0}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerHealthReport.groq?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerHealthReport.groq?.requestCount > 0 
                      ? `${Math.round((providerHealthReport.groq.successCount / providerHealthReport.groq.requestCount) * 100)}%`
                      : '100%'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Serper API Key Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-bold text-white">Serper API Key</span>
                  <span className="text-[10px] text-sky-400/90 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded font-mono">
                    Google Search API
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={serperEnabled}
                      onChange={(e) => setSerperEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.serper?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.serper?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.serper?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showSerperKey ? 'text' : 'password'}
                    value={serperKey}
                    onChange={(e) => setSerperKey(e.target.value)}
                    placeholder="Enter Serper API Key (e.g. 840a...)"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSerperKey(!showSerperKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showSerperKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('serper', setTestingSerper, setSerperTestResult, serperKey)}
                  disabled={testingSerper}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingSerper ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-sky-400" />}
                  <span>Test Serper</span>
                </button>
              </div>

              {serperTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${serperTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {serperTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{serperTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerHealthReport.serper?.circuitBreakerState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerHealthReport.serper?.circuitBreakerState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerHealthReport.serper?.circuitBreakerState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">API Success / Fail</span>
                  <span className="font-semibold text-white mt-0.5 font-mono flex items-center space-x-1">
                    <span className="text-[#10b981]">{providerHealthReport.serper?.successCount || 0}</span>
                    <span className="text-gray-500">/</span>
                    <span className={providerHealthReport.serper?.failureCount > 0 ? 'text-rose-400' : 'text-gray-400'}>
                      {providerHealthReport.serper?.failureCount || 0}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerHealthReport.serper?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerHealthReport.serper?.requestCount > 0 
                      ? `${Math.round((providerHealthReport.serper.successCount / providerHealthReport.serper.requestCount) * 100)}%`
                      : '100%'}
                  </span>
                </div>
              </div>

              {runtimeState.providers.serper?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.serper.message}
                </div>
              )}
            </div>

            {/* 4. Firecrawl API Key Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <Bot className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">Firecrawl API Key</span>
                  <span className="text-[10px] text-amber-400/90 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded font-mono">
                    Web Scraping API
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={firecrawlEnabled}
                      onChange={(e) => setFirecrawlEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.firecrawl?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.firecrawl?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.firecrawl?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showFirecrawlKey ? 'text' : 'password'}
                    value={firecrawlKey}
                    onChange={(e) => setFirecrawlKey(e.target.value)}
                    placeholder="Enter Firecrawl API Key (e.g. fc-...)"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirecrawlKey(!showFirecrawlKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showFirecrawlKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('firecrawl', setTestingFirecrawl, setFirecrawlTestResult, firecrawlKey)}
                  disabled={testingFirecrawl}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingFirecrawl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                  <span>Test Firecrawl</span>
                </button>
              </div>

              {firecrawlTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${firecrawlTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {firecrawlTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{firecrawlTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerMetrics.firecrawl?.circuitState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerMetrics.firecrawl?.circuitState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerMetrics.firecrawl?.circuitState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.firecrawl?.requestCount > 0 
                      ? `${Math.round((providerMetrics.firecrawl.successCount / providerMetrics.firecrawl.requestCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.firecrawl?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Scrapes (Total)</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.firecrawl?.requestCount || 0} queries
                  </span>
                </div>
              </div>

              {runtimeState.providers.firecrawl?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.firecrawl.message}
                </div>
              )}
            </div>

            {/* 5. Hunter API Key Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Hunter API Key</span>
                  <span className="text-[10px] text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                    Email Discovery API
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hunterEnabled}
                      onChange={(e) => setHunterEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.hunter?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.hunter?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.hunter?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showHunterKey ? 'text' : 'password'}
                    value={hunterKey}
                    onChange={(e) => setHunterKey(e.target.value)}
                    placeholder="Enter Hunter API Key (e.g. 52f7...)"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHunterKey(!showHunterKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showHunterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('hunter', setTestingHunter, setHunterTestResult, hunterKey)}
                  disabled={testingHunter}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingHunter ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>Test Hunter</span>
                </button>
              </div>

              {hunterTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${hunterTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {hunterTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{hunterTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerMetrics.hunter?.circuitState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerMetrics.hunter?.circuitState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerMetrics.hunter?.circuitState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.hunter?.requestCount > 0 
                      ? `${Math.round((providerMetrics.hunter.successCount / providerMetrics.hunter.requestCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.hunter?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Requests</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.hunter?.requestCount || 0} queries
                  </span>
                </div>
              </div>

              {runtimeState.providers.hunter?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.hunter.message}
                </div>
              )}
            </div>

            {/* 6. Tavily API Key Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-white">Tavily API Key</span>
                  <span className="text-[10px] text-indigo-400/90 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded font-mono">
                    Web Search & Agentic API
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tavilyEnabled}
                      onChange={(e) => setTavilyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.tavily?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.tavily?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.tavily?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showTavilyKey ? 'text' : 'password'}
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    placeholder="Enter Tavily API Key (e.g. tvly-...)"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTavilyKey(!showTavilyKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showTavilyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('tavily', setTestingTavily, setTavilyTestResult, tavilyKey)}
                  disabled={testingTavily}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingTavily ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>Test Tavily</span>
                </button>
              </div>

              {tavilyTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${tavilyTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {tavilyTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{tavilyTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerMetrics.tavily?.circuitState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerMetrics.tavily?.circuitState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerMetrics.tavily?.circuitState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.tavily?.requestCount > 0 
                      ? `${Math.round((providerMetrics.tavily.successCount / providerMetrics.tavily.requestCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.tavily?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Requests</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.tavily?.requestCount || 0} queries
                  </span>
                </div>
              </div>

              {runtimeState.providers.tavily?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.tavily.message}
                </div>
              )}
            </div>

            {/* 7. Exa API Key Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span className="text-sm font-bold text-white">Exa API Key</span>
                  <span className="text-[10px] text-pink-400/90 bg-pink-950/60 border border-pink-800/60 px-2 py-0.5 rounded font-mono">
                    Semantic Web API
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exaEnabled}
                      onChange={(e) => setExaEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.exa?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.exa?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.exa?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showExaKey ? 'text' : 'password'}
                    value={exaKey}
                    onChange={(e) => setExaKey(e.target.value)}
                    placeholder="Enter Exa API Key"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExaKey(!showExaKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showExaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('exa', setTestingExa, setExaTestResult, exaKey)}
                  disabled={testingExa}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingExa ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-pink-400" />}
                  <span>Test Exa</span>
                </button>
              </div>

              {exaTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${exaTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {exaTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{exaTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerMetrics.exa?.circuitState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerMetrics.exa?.circuitState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerMetrics.exa?.circuitState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.exa?.requestCount > 0 
                      ? `${Math.round((providerMetrics.exa.successCount / providerMetrics.exa.requestCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.exa?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Requests</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.exa?.requestCount || 0} queries
                  </span>
                </div>
              </div>

              {runtimeState.providers.exa?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.exa.message}
                </div>
              )}
            </div>

            {/* 8. Linkup API Key Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <Sliders className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-bold text-white">Linkup API Key</span>
                  <span className="text-[10px] text-violet-400/90 bg-violet-950/60 border border-violet-800/60 px-2 py-0.5 rounded font-mono">
                    Premium Content API
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkupEnabled}
                      onChange={(e) => setLinkupEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.linkup?.configured ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.linkup?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.linkup?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLinkupKey ? 'text' : 'password'}
                    value={linkupKey}
                    onChange={(e) => setLinkupKey(e.target.value)}
                    placeholder="Enter Linkup API Key"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLinkupKey(!showLinkupKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showLinkupKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('linkup', setTestingLinkup, setLinkupTestResult, linkupKey)}
                  disabled={testingLinkup}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingLinkup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-violet-400" />}
                  <span>Test Linkup</span>
                </button>
              </div>

              {linkupTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${linkupTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {linkupTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{linkupTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerMetrics.linkup?.circuitState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerMetrics.linkup?.circuitState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerMetrics.linkup?.circuitState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.linkup?.requestCount > 0 
                      ? `${Math.round((providerMetrics.linkup.successCount / providerMetrics.linkup.requestCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.linkup?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Requests</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.linkup?.requestCount || 0} queries
                  </span>
                </div>
              </div>

              {runtimeState.providers.linkup?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.linkup.message}
                </div>
              )}
            </div>

            {/* 9. Apify Advanced Browser Scraping Card */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <Bot className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">Apify API Key</span>
                  <span className="text-[10px] text-amber-400/90 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded font-mono">
                    Advanced Browser Crawling (Playwright/Firefox)
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Enable / Disable Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apifyEnabled}
                      onChange={(e) => setApifyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#1a1a1a] border border-[#333333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-white"></div>
                    <span className="ml-2 text-[11px] text-gray-400 font-medium">Enabled</span>
                  </label>

                  {runtimeState.providers.apify?.configured || hasApifyKey ? (
                    <span className={`inline-flex items-center space-x-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                      runtimeState.providers.apify?.status === 'healthy'
                        ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
                        : 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{runtimeState.providers.apify?.status === 'healthy' ? 'Healthy' : 'Configured'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-gray-400 bg-gray-800/40 border border-gray-700/40 px-2.5 py-0.5 rounded-full font-medium">
                      <XCircle className="w-3 h-3" />
                      <span>Not Configured</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showApifyKey ? 'text' : 'password'}
                    value={apifyKey}
                    onChange={(e) => setApifyKey(e.target.value)}
                    placeholder="Enter Apify API Token (ap_...)"
                    className="w-full pl-9 pr-10 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApifyKey(!showApifyKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showApifyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleTestService('apify', setTestingApify, setApifyTestResult, apifyKey)}
                  disabled={testingApify}
                  className="px-4 py-2 rounded-lg bg-[#333333] hover:bg-[#404040] disabled:opacity-50 text-xs font-semibold text-white border border-[#444444] transition-colors flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {testingApify ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                  <span>Test Apify</span>
                </button>
              </div>

              {apifyTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${apifyTestResult.success ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                  {apifyTestResult.success ? <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span>{apifyTestResult.message}</span>
                </div>
              )}

              {/* Real-time metrics and circuit breaker feedback */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Circuit Breaker</span>
                  <span className={`font-semibold mt-0.5 font-mono ${
                    (providerMetrics.apify?.circuitState === 'OPEN') 
                      ? 'text-rose-400' 
                      : (providerMetrics.apify?.circuitState === 'HALF-OPEN' ? 'text-amber-400' : 'text-[#10b981]')
                  }`}>
                    {providerMetrics.apify?.circuitState || 'CLOSED'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Success Rate</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.apify?.requestCount > 0 
                      ? `${Math.round((providerMetrics.apify.successCount / providerMetrics.apify.requestCount) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Avg Latency</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.apify?.averageLatencyMs || 0} ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Requests</span>
                  <span className="font-semibold text-white mt-0.5 font-mono">
                    {providerMetrics.apify?.requestCount || 0} scrapes
                  </span>
                </div>
              </div>

              {runtimeState.providers.apify?.message && (
                <div className="text-[11px] text-gray-400 italic bg-[#1a1a1a] px-3 py-1.5 rounded border border-[#333333]/40">
                  <span className="text-gray-500 font-medium">Status: </span>
                  {runtimeState.providers.apify.message}
                </div>
              )}
            </div>

            {/* Research Orchestrator Performance Analytics Dashboard */}
            <div className="bg-[#262626] rounded-xl p-5 border border-[#333333] space-y-4">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">Dynamic Research Scoring & Capability Matrix</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                The multi-dimensional orchestration engine scores and routes queries in real-time based on your objective (e.g., target domain search, leadership discovery, semantic queries). Below is the active routing capability hierarchy:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] space-y-2">
                  <span className="text-[11px] font-bold text-gray-300 block uppercase tracking-wider">Strategic Priority & Objective Routing rules</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-gray-400 border-b border-[#333333]/40 pb-1">
                      <span>Target: <strong className="text-emerald-400 font-normal">Corporate Emails</strong></span>
                      <span className="font-mono text-white text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded">HUNTER (Score 100)</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-400 border-b border-[#333333]/40 pb-1">
                      <span>Target: <strong className="text-pink-400 font-normal">Leadership Discovery</strong></span>
                      <span className="font-mono text-white text-[10px] bg-pink-950 px-1.5 py-0.5 rounded">EXA (Score 95)</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-400 border-b border-[#333333]/40 pb-1">
                      <span>Target: <strong className="text-indigo-400 font-normal">Broad Web Research</strong></span>
                      <span className="font-mono text-white text-[10px] bg-indigo-950 px-1.5 py-0.5 rounded">TAVILY (Score 90)</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-400 border-b border-[#333333]/40 pb-1">
                      <span>Target: <strong className="text-amber-400 font-normal">JS-Heavy Browser Scrape</strong></span>
                      <span className="font-mono text-white text-[10px] bg-amber-950 px-1.5 py-0.5 rounded">APIFY (Score 100)</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Target: <strong className="text-sky-400 font-normal">Base Search Fallback</strong></span>
                      <span className="font-mono text-white text-[10px] bg-sky-950 px-1.5 py-0.5 rounded">SERPER (Score 80)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#333333] space-y-2">
                  <span className="text-[11px] font-bold text-gray-300 block uppercase tracking-wider">Active Provider Capability Map</span>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
                    <div className="p-1.5 rounded bg-sky-950/40 border border-sky-800/40 text-sky-400">Google Index</div>
                    <div className="p-1.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">Email Intelligence</div>
                    <div className="p-1.5 rounded bg-pink-950/40 border border-pink-800/40 text-pink-400">Semantic Search</div>
                    <div className="p-1.5 rounded bg-indigo-950/40 border border-indigo-800/40 text-indigo-400">Broad Crawls</div>
                    <div className="p-1.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-400">Apify Firefox</div>
                    <div className="p-1.5 rounded bg-violet-950/40 border border-violet-800/40 text-violet-400">Link Retrieval</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetSettings}
                disabled={resettingSettings}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#262626] hover:bg-[#333333] border border-[#333333] text-gray-300 font-semibold text-xs transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>{resettingSettings ? 'Resetting...' : 'Reset to Defaults'}</span>
              </button>

              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#10b981]/90 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
              >
                {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-white" />}
                <span>{savingSettings ? 'Saving Settings...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
