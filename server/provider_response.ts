/** Bounded body consumption: a headers-only fetch timeout is not sufficient. */
export function providerSchemaError(message: string): Error {
  return Object.assign(new Error(message), { name: 'ProviderSchemaError' });
}

/** Validate required provider envelopes without stripping unknown fields. */
export function validateProviderEnvelope(body: unknown, kind: 'serper' | 'hunter' | 'ai'): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw providerSchemaError('Provider payload is not an object');
  const value = body as Record<string, any>;
  if (value.error || (Array.isArray(value.errors) && value.errors.length) || (typeof value.statusCode === 'number' && value.statusCode >= 400)) throw providerSchemaError('Provider returned an error payload');
  if (kind === 'ai') {
    if (!Array.isArray(value.choices) || typeof value.choices[0]?.message?.content !== 'string' || !value.choices[0].message.content.trim()) throw providerSchemaError('AI provider returned no usable message content');
  } else if (kind === 'hunter') {
    if (!value.data || typeof value.data !== 'object' || !Array.isArray(value.data.emails)) throw providerSchemaError('Hunter payload lacks domain email records');
  } else {
    const collections = ['organic', 'peopleAlsoAsk', 'relatedSearches', 'images', 'news', 'videos', 'places'];
    if (collections.some(key => value[key] !== undefined && !Array.isArray(value[key]))) throw providerSchemaError('Serper result collection has an invalid shape');
    if (!collections.some(key => Array.isArray(value[key])) && !value.searchParameters && !value.knowledgeGraph && !value.answerBox) throw providerSchemaError('Serper payload contains no recognized search envelope');
  }
}

export async function readProviderResponse(response: Response, maxBytes = 8 * 1024 * 1024, timeoutMs = 20_000, allowArray = false): Promise<{ body: unknown; failure?: { name: string; message: string; status: number } }> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 32 * 1024 * 1024 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid provider response bounds');
  const reader = response.body?.getReader();
  // One bounded allocation avoids millions of tiny chunks and race callbacks
  // retaining far more memory than the configured body limit.
  const buffer = Buffer.allocUnsafe(maxBytes);
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fail = (name: string, message: string) => Object.assign(new Error(message), { name, status: response.status });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(fail('ProviderBodyTimeout', 'Provider response body timeout')), timeoutMs);
  });
  try {
    await Promise.race([(async () => {
      if (reader) while (true) {
        const next = await reader.read();
        if (next.done) break;
        if (size + next.value.byteLength > maxBytes) throw fail('ProviderBodyLimit', `Provider response exceeds ${maxBytes} byte capture limit`);
        buffer.set(next.value, size);
        size += next.value.byteLength;
      }
    })(), deadline]);
    const bytes = buffer.subarray(0, size);
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch {
      return { body: { encoding: 'base64', bytes: bytes.toString('base64') }, failure: { name: 'ProviderSchemaError', message: 'Provider response is not valid UTF-8', status: response.status } };
    }
    try {
      const body: unknown = JSON.parse(text);
      if (!body || typeof body !== 'object' || (!allowArray && Array.isArray(body))) throw new Error('Expected a JSON object');
      return { body };
    } catch {
      return { body: text, failure: { name: 'ProviderSchemaError', message: 'Provider returned malformed JSON or a non-object payload', status: response.status } };
    }
  } finally {
    clearTimeout(timer);
    // Do not wait indefinitely for a broken upstream stream to acknowledge cancel.
    if (reader) void reader.cancel().catch(() => {});
  }
}
