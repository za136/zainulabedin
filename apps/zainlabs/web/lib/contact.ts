import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { streams } from "@zainlabs/content";

export interface ContactRequest {
  name: string;
  email: string;
  company?: string;
  stream: string;
  message: string;
  consent: boolean;
  source: "web" | "app";
  website?: string; // honeypot
}

export function validateContact(body: unknown): { ok: true; value: ContactRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const value: ContactRequest = {
    name: str("name", 120),
    email: str("email", 200),
    company: str("company", 160) || undefined,
    stream: str("stream", 40),
    message: str("message", 4000),
    consent: b.consent === true,
    source: b.source === "app" ? "app" : "web",
    website: str("website", 200),
  };
  if (!value.name) return { ok: false, error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return { ok: false, error: "Please enter a valid email address." };
  if (value.message.length < 10) return { ok: false, error: "Please tell us a little more (at least 10 characters)." };
  if (!streams.some((s) => s.slug === value.stream)) return { ok: false, error: "Unknown stream." };
  if (!value.consent) return { ok: false, error: "Please agree to the privacy notice." };
  return { ok: true, value };
}

/** Stores the request as one JSON line and optionally forwards it to a webhook (e.g. n8n, Slack, CRM). */
export async function storeContact(req: ContactRequest): Promise<string> {
  const id = crypto.randomUUID();
  const record = { id, receivedAt: new Date().toISOString(), ...req, website: undefined };
  const dir = process.env.CONTACT_STORE_DIR ?? path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await appendFile(path.join(dir, "contact-requests.jsonl"), JSON.stringify(record) + "\n");
  const hook = process.env.CONTACT_WEBHOOK_URL;
  if (hook) {
    await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) }).catch(
      () => undefined,
    );
  }
  return id;
}
