/** Bounded body consumption: a headers-only fetch timeout is not sufficient. */
export async function readProviderResponse(response: Response, maxBytes = 8 * 1024 * 1024, timeoutMs = 20_000): Promise<{ body: unknown; failure?: { name: string; message: string; status: number } }> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fail = (name: string, message: string) => Object.assign(new Error(message), { name, status: response.status });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(fail('ProviderBodyTimeout', 'Provider response body timeout')), timeoutMs);
  });
  try {
    if (reader) while (true) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) throw fail('ProviderBodyLimit', `Provider response exceeds ${maxBytes} byte capture limit`);
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks, size);
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch {
      return { body: { encoding: 'base64', bytes: bytes.toString('base64') }, failure: { name: 'ProviderSchemaError', message: 'Provider response is not valid UTF-8', status: response.status } };
    }
    try {
      const body: unknown = JSON.parse(text);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected a JSON object');
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
