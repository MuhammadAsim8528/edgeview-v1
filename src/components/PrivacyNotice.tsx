import React from 'react';

/** Describes current data flows; does not imply unfinished consent or licensing. */
export function PrivacyNotice() {
  return <section aria-labelledby="privacy-notice-title" className="rounded-xl border border-[#333] bg-[#1a1a1a] p-4 text-sm text-gray-300">
    <details>
      <summary id="privacy-notice-title" className="cursor-pointer font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">Privacy and external services</summary>
      <div className="mt-4 space-y-3">
        <p>Imported files, saved contacts and research evidence are stored on this computer. Keep backups private. Local storage does not protect data from someone who can access your Windows account.</p>
        <h3 className="font-semibold text-white">Research requests</h3>
        <p>Enrichment sends the company name, country and generated queries to configured search services. NVIDIA NIM or Groq can receive this identity and selected fetched website text for query generation and evidence extraction. Hunter can receive the resolved company domain when enabled. Websites and providers receive network connection information, including your IP address, and apply their own policies.</p>
        <p>Provider switches and credentials are managed in V1 provider configuration below. Provider connection tests also make external requests. Research needs network access; missing or exhausted provider access can leave results incomplete.</p>
        <h3 className="font-semibold text-white">Optional monitoring</h3>
        <p>Sentry reports allowed error codes and PostHog records allowed usage events when monitoring is configured and enabled. Reports can include version, build, release channel and a random installation identifier. That identifier is not hardware licensing. Session replay is off.</p>
        <p>Monitoring must exclude imported rows, company or contact details, prompts, research bodies, credentials, private paths and raw exception text. Search and AI requests are separate from monitoring. The Remote monitoring panel shows observed configuration and delivery state; transport success does not prove dashboard receipt.</p>
        <p>This candidate controls monitoring through launch configuration. An in-app on/off switch is not yet available; ask the person managing this installation to change it. Monitoring is not required for startup.</p>
        <h3 className="font-semibold text-white">Support sharing and retention</h3>
        <p>Preview support diagnostics before downloading or sharing them. Downloading does not upload the file to support. Research history and local backups are not included in that diagnostics download. No automatic deletion period for your local research is promised by this candidate; retain or remove files only through an agreed backup and recovery process.</p>
      </div>
    </details>
  </section>;
}
