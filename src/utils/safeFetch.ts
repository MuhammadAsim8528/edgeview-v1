export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  rawText?: string;
  code?: string;
  path?: string;
  requestId?: string;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  const path = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const res = await fetch(input, init);
    const requestId = res.headers.get('x-request-id') || undefined;
    const text = await res.text();
    let data: any = null;

    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = null;
      }
    }

    if (!res.ok) {
      let errorMsg =
        data?.error ||
        data?.message ||
        data?.details ||
        `Request failed with status ${res.status}`;

      if (!data && (text.startsWith('<!DOCTYPE') || text.startsWith('<html'))) {
        errorMsg = `Server error (Status ${res.status}). Received non-JSON HTML output.`;
      }

      return {
        ok: false,
        status: res.status,
        data,
        error: errorMsg,
        rawText: text,
        code: data?.code || `HTTP_${res.status}`,
        path,
        requestId,
      };
    }

    if (!data && text.trim()) {
      const isHtml = text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html');
      return {
        ok: false,
        status: res.status,
        data: null,
        error: isHtml
          ? `Server returned an HTML error page instead of JSON (Status ${res.status}).`
          : `Server returned non-JSON response.`,
        rawText: text,
        code: 'INVALID_RESPONSE',
        path,
        requestId,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
      rawText: text,
      path,
      requestId,
    };
  } catch (networkErr: any) {
    const backend = typeof window === 'undefined' ? 'the EdgeView backend' : window.location.origin;
    return {
      ok: false,
      status: 0,
      data: null,
      error: `Cannot reach the EdgeView backend at ${backend}. Open EdgeView from the URL printed by the running server.`,
      code: 'EDGEVIEW_BACKEND_UNREACHABLE',
      path,
    };
  }
}
