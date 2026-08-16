import type { ApiErrorBody, ApiResponse, ErrorCode, FieldIssue } from './types';

/**
 * The typed fetch wrapper for the Admin API.
 *
 * Every server response is the `{ok, data|error, rev}` envelope (game repo
 * `shared/src/api.ts`), so unwrapping happens in exactly one place and callers only ever
 * see either the payload or a thrown `ApiError`.
 */

/** Same-origin in both dev (Vite proxy) and production (nginx). */
export const ADMIN_API_PREFIX = '/admin/api';

/**
 * The player API prefix.
 *
 * The suite touches exactly one route under it — `GET /api/health`, which is admin-rank
 * gated and is where the dashboard's server-health strip comes from (§2.1). It was never
 * moved under `/admin/api` because `STATUS.sh` reads it too.
 */
export const PLAYER_API_PREFIX = '/api';

export const ADMIN_ROUTES = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  content: {
    overview: '/content',
    collection: (path: string) => `/content/${path}`,
    item: (path: string, key: string) => `/content/${path}/${encodeURIComponent(key)}`,
    revertDraft: (path: string, key: string) =>
      `/content/${path}/${encodeURIComponent(key)}/revert-draft`,
    validate: '/content/validate',
    diff: '/content/diff',
    publish: '/content/publish',
    revert: '/content/revert',
    revisions: '/content/revisions',
    discard: '/content/discard',
  },
  stats: {
    overview: '/stats/overview',
  },
} as const;

/**
 * A failed Admin API call.
 *
 * Carries the server's own code, message and requestId so toasts can quote them
 * verbatim — an operator reporting a bug should be able to read the request id straight
 * off the screen (ADMIN_SUITE_DESIGN §4).
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;
  readonly rev: number | undefined;

  constructor(body: ApiErrorBody, options: { status: number; rev?: number; requestId?: string }) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = options.status;
    this.details = body.details;
    this.requestId = body.requestId ?? options.requestId;
    this.rev = options.rev;
  }

  /** True when the session is gone — the guard turns this into a redirect to login. */
  get isAuthFailure(): boolean {
    return this.code === 'AUTH_REQUIRED' || this.status === 401;
  }

  /**
   * Field-level issues from a VALIDATION failure, if the server sent them in the shape
   * the content routes use (`[{path, message}]`).
   */
  fieldIssues(): FieldIssue[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.filter(
      (issue): issue is FieldIssue =>
        typeof issue === 'object' &&
        issue !== null &&
        typeof Reflect.get(issue, 'path') === 'string' &&
        typeof Reflect.get(issue, 'message') === 'string',
    );
  }
}

/** Network failure, HTML error page, or anything else that is not our envelope. */
function transportError(message: string, status: number): ApiError {
  return new ApiError({ code: 'INTERNAL', message }, { status });
}

/** The last `rev` any response carried — the top bar reads it without its own request. */
let lastSeenRev: number | null = null;
const revListeners = new Set<(rev: number) => void>();

export function currentRev(): number | null {
  return lastSeenRev;
}

/** Subscribe to revision changes; returns the unsubscribe function. */
export function onRevChange(listener: (rev: number) => void): () => void {
  revListeners.add(listener);
  return () => revListeners.delete(listener);
}

function noteRev(rev: unknown): void {
  if (typeof rev !== 'number' || rev === lastSeenRev) return;
  lastSeenRev = rev;
  for (const listener of revListeners) listener(rev);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Defaults to the Admin API; only the health probe overrides it. */
  prefix?: string;
}

/**
 * Performs one Admin API call and unwraps the envelope.
 *
 * `credentials: 'same-origin'` is what carries the httpOnly session cookie; the suite
 * never reads or stores the token itself.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, prefix = ADMIN_API_PREFIX } = options;

  let response: Response;
  try {
    response = await fetch(`${prefix}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw transportError('Could not reach the game server.', 0);
  }

  const requestId = response.headers.get('x-request-id') ?? undefined;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // A non-JSON body means something upstream of the API answered — a proxy error
    // page, most likely. Report the status rather than a misleading parse error.
    throw transportError(
      `The server returned ${response.status} ${response.statusText || 'without a response body'}.`,
      response.status,
    );
  }

  if (!isEnvelope(payload)) {
    throw transportError('The server returned an unexpected response.', response.status);
  }

  noteRev(payload.rev);

  if (!payload.ok) {
    throw new ApiError(payload.error, {
      status: response.status,
      rev: payload.rev,
      requestId,
    });
  }

  return payload.data;
}

function isEnvelope(value: unknown): value is ApiResponse<never> {
  if (typeof value !== 'object' || value === null) return false;
  const ok = Reflect.get(value, 'ok');
  if (typeof ok !== 'boolean') return false;
  if (ok) return 'data' in value;
  const error = Reflect.get(value, 'error');
  return (
    typeof error === 'object' && error !== null && typeof Reflect.get(error, 'code') === 'string'
  );
}
