// Never accept exceptions, component stacks, URLs or application data here.
// The backend supplies release/build/install identity and the fixed event schema.
let reports = 0;
export async function reportFrontendCrash(): Promise<void> {
  if (reports >= 5) return;
  reports += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch('/api/monitoring/frontend-error', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'REACT_RENDER_FAILED' }), signal: controller.signal,
      credentials: 'same-origin',
    });
  } catch { /* Crash recovery must work when monitoring/backend is unavailable. */ }
  finally { clearTimeout(timer); }
}
