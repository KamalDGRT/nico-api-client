import {
  CONTENT_TYPE_JSON,
  DEFAULT_ERROR_MESSAGE,
  HTTP_NO_CONTENT,
} from "./constants";

export class ApiError extends Error {
  status: number;
  // One entry per error the server reported; `message` is these joined.
  messages: string[];
  constructor(message: string, status: number, messages: string[] = [message]) {
    super(message);
    this.status = status;
    this.messages = messages;
  }
}

// What ApiClient needs: something that turns a path + RequestInit into a
// Response. An app's authFetch (bearer token + refresh-on-401) satisfies it,
// but so does createPublicFetcher below.
export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

// Fetcher for APIs that need no auth (public third-party APIs, our own
// unauthenticated routes).
export function createPublicFetcher(baseUrl: string): Fetcher {
  return (path, init) => fetch(`${baseUrl}${path}`, init);
}

// Every error response is {"errors": [{"detail", ...}, ...]} — several items
// when a call reports more than one problem at once. A plain string body is
// taken as the message. Empty when the body has neither.
function extractErrorMessages(body: unknown): string[] {
  if (typeof body === "string") return [body];
  const errors = (body as { errors?: { detail?: unknown }[] })?.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e) => e?.detail)
    .filter((detail): detail is string => typeof detail === "string");
}

// The server's message for an ApiError (already human-readable), else the
// caller's own fallback for network failures and other thrown values.
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const extracted = extractErrorMessages(body);
  const messages = extracted.length > 0 ? extracted : [DEFAULT_ERROR_MESSAGE];
  throw new ApiError(messages.join(" "), res.status, messages);
}

export async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) return throwApiError(res);
  // 204 No Content has no body — res.json() would throw on it.
  return res.status === HTTP_NO_CONTENT ? (undefined as T) : res.json();
}

// Same error shape as parseJsonOrThrow, for endpoints whose success body is
// raw text (e.g. a full HTML document meant for `iframe.srcDoc`).
export async function parseTextOrThrow(res: Response): Promise<string> {
  return res.ok ? res.text() : throwApiError(res);
}

function isRawBody(body: unknown): body is FormData | URLSearchParams {
  return body instanceof FormData || body instanceof URLSearchParams;
}

/**
 * Base class for per-domain services: subclasses add typed methods that call
 * the protected get/post/put/delete helpers. Takes any Fetcher, authenticated
 * or not. `headers` are merged over (and can override) the defaults — e.g. a
 * one-off Authorization, an If-Match, an idempotency key.
 */
export class ApiClient {
  constructor(protected fetcher: Fetcher) {}

  protected get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.fetcher(path, headers ? { headers } : undefined).then((res) =>
      parseJsonOrThrow<T>(res),
    );
  }

  protected getText(
    path: string,
    headers?: Record<string, string>,
  ): Promise<string> {
    return this.fetcher(path, headers ? { headers } : undefined).then((res) =>
      parseTextOrThrow(res),
    );
  }

  protected post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("POST", path, body, headers);
  }

  protected put<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("PUT", path, body, headers);
  }

  protected patch<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("PATCH", path, body, headers);
  }

  protected delete<T = void>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>("DELETE", path, body, headers);
  }

  private request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const hasBody = body !== undefined;
    // Forms and uploads go out as-is; the browser sets their Content-Type
    // (including the multipart boundary).
    const isRaw = isRawBody(body);
    return this.fetcher(path, {
      method,
      headers: {
        ...(hasBody && !isRaw && { "Content-Type": CONTENT_TYPE_JSON }),
        ...headers,
      },
      ...(hasBody && { body: isRaw ? body : JSON.stringify(body) }),
    }).then((res) => parseJsonOrThrow<T>(res));
  }
}
