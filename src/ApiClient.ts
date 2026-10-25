import {
  CONTENT_TYPE_JSON,
  DEFAULT_ERROR_MESSAGE,
  HTTP_NO_CONTENT,
} from "./constants";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
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
// when a call reports more than one problem at once. Join them into one
// message rather than showing only the first.
function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body;
  const errors = (body as { errors?: { detail?: unknown }[] })?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const messages = errors
    .map((e) => (typeof e?.detail === "string" ? e.detail : undefined))
    .filter((m): m is string => Boolean(m));
  return messages.length > 0 ? messages.join(" ") : undefined;
}

// The server's message for an ApiError (already human-readable), else the
// caller's own fallback for network failures and other thrown values.
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new ApiError(
    extractErrorMessage(body) ?? DEFAULT_ERROR_MESSAGE,
    res.status,
  );
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
    return this.fetcher(path, {
      method,
      headers: {
        ...(hasBody && { "Content-Type": CONTENT_TYPE_JSON }),
        ...headers,
      },
      ...(hasBody && { body: JSON.stringify(body) }),
    }).then((res) => parseJsonOrThrow<T>(res));
  }
}
