/**
 * Typed client for the ZAIN LABS API (apps/zainlabs/api, contract: apps/zainlabs/api/openapi.json).
 * The website and the app MUST call the backend only through this file. Tests fail if they call
 * fetch() on an API path directly, or if this file uses an endpoint that is not in openapi.json.
 */
import type { ContentBundle } from "./index";
import type { Project, StreamSlug } from "./types";

export type ApiErrorCode =
  | "validation_error"
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "admin_disabled"
  | "network_error"
  | "http_error";

export interface ApiError {
  ok: false;
  status: number; // 0 for network errors
  code: ApiErrorCode;
  error: string; // safe to show to the user
  fields?: Record<string, string>; // per-field messages for validation_error
}
export type ApiResult<T> = { ok: true; data: T } | ApiError;

export interface ContactInput {
  name: string; // 1-120 chars
  email: string; // max 200
  company?: string; // max 160
  stream: StreamSlug;
  project?: string; // project slug
  message: string; // 10-4000 chars
  consent: boolean; // must be true
  source: "web" | "app";
  website?: string; // honeypot: render hidden, leave empty
}

export interface NewsletterInput {
  email: string;
  consent: boolean; // must be true
  source: "web" | "app";
  website?: string; // honeypot
}

export function createApi(baseUrl = "", fetchImpl: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/$/, "");

  async function call<T>(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 10000): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (res.ok) return { ok: true, data: json as T };
      return {
        ok: false,
        status: res.status,
        code: (json?.code as ApiErrorCode) ?? "http_error",
        error: json?.error ?? `Request failed (HTTP ${res.status}).`,
        fields: json?.fields,
      };
    } catch {
      return { ok: false, status: 0, code: "network_error", error: "No connection. Please try again." };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** GET /api/content: site copy, streams and projects. */
    getContent: () => call<ContentBundle>("GET", "/api/content"),
    /** GET /api/projects/{slug} */
    getProject: (slug: string) => call<Project>("GET", `/api/projects/${encodeURIComponent(slug)}`),
    /** POST /api/contact → 201 {ok, id}. 422 validation_error with fields, 429 rate_limited. */
    sendContact: (input: ContactInput) => call<{ ok: true; id: string }>("POST", "/api/contact", input),
    /** POST /api/newsletter → 202 {ok, status: "pending"}; user must confirm via email (double opt-in). */
    subscribe: (input: NewsletterInput) => call<{ ok: true; status: "pending" }>("POST", "/api/newsletter", input),
  };
}

export type Api = ReturnType<typeof createApi>;
