import React, { useEffect, useRef, useState } from 'react';
import { safeFetchJson } from '../utils/safeFetch';

type Preferences = { errors: boolean; usage: boolean };
type Status = { enabled: boolean; preferences: Preferences; sentry: { state: string }; posthog: { state: string } };
function valid(value: any): value is Status {
  return typeof value?.enabled === 'boolean' && typeof value?.preferences?.errors === 'boolean'
    && typeof value?.preferences?.usage === 'boolean' && typeof value?.sentry?.state === 'string' && typeof value?.posthog?.state === 'string';
}

export function MonitoringControls() {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState<Preferences>({ errors: false, usage: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  async function perform(save = false) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const deadline = setTimeout(() => controller.abort(), 15_000);
    setBusy(true); setMessage('');
    const result = await safeFetchJson<{ success: boolean; monitoring: Status }>(save ? '/api/monitoring/preferences' : '/api/monitoring/status', {
      signal: controller.signal,
      ...(save ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) } : {}),
    });
    clearTimeout(deadline);
    if (request.current !== controller) return;
    request.current = null; setBusy(false);
    if (!result.ok || !result.data?.success || !valid(result.data.monitoring)) {
      setMessage(save ? 'Save could not be confirmed. Reload preferences before retrying.' : 'Monitoring preferences could not be loaded. Retry to see the current state.');
      if (!save) setStatus(null);
      return;
    }
    setStatus(result.data.monitoring); setDraft(result.data.monitoring.preferences);
    if (save) setMessage('Monitoring preferences saved.');
  }
  useEffect(() => {
    void perform();
    return () => { const active = request.current; request.current = null; active?.abort(); };
  }, []);
  return <section aria-labelledby="monitoring-controls-title" className="rounded-xl border border-[#333] bg-[#1a1a1a] p-4 text-sm text-gray-300">
    <h3 id="monitoring-controls-title" className="font-semibold text-white">Monitoring preferences</h3>
    <p className="mt-2 text-xs">Optional reports exclude business content. These choices do not change research-provider requests. Session replay stays off.</p>
    {status && <>
      <fieldset disabled={busy} className="mt-3 space-y-3">
        <legend className="sr-only">Optional monitoring choices</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.errors} onChange={e => setDraft(current => ({ ...current, errors: e.target.checked }))} />Allow sanitized error reports to Sentry</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.usage} onChange={e => setDraft(current => ({ ...current, usage: e.target.checked }))} />Allow minimal usage analytics to PostHog</label>
        <button type="button" onClick={() => void perform(true)} className="rounded border border-emerald-700 px-3 py-2 text-white">Save monitoring preferences</button>
      </fieldset>
      <p className="mt-3 text-xs">Sentry: {status.sentry.state}. PostHog: {status.posthog.state}.</p>
      {!status.enabled && <p className="mt-2 text-xs">Monitoring is disabled by this installation’s launch configuration. Saving these choices cannot enable it.</p>}
    </>}
    <p className="mt-2 text-xs">Turning a choice off stops new and queued-but-unsent reports. Requests already sent may finish; previously received events are not deleted.</p>
    <button type="button" disabled={busy} onClick={() => void perform()} className="mt-3 rounded border border-[#555] px-3 py-2 disabled:opacity-50">{busy ? 'Please wait…' : 'Reload monitoring preferences'}</button>
    <p role="status" aria-live="polite" className="mt-2 text-xs">{message}</p>
  </section>;
}
