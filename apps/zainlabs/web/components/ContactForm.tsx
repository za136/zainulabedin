"use client";

import { useState } from "react";
import { streams, type StreamSlug } from "@zainlabs/content";
import { api } from "@/lib/api";

export function ContactForm({ project }: { project?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const result = await api.sendContact({
      name: text("name"),
      email: text("email"),
      company: text("company") || undefined,
      stream: text("stream") as StreamSlug,
      project: project || undefined,
      message: text("message"),
      consent: form.get("consent") === "on",
      source: "web",
      website: text("website"),
    });
    if (result.ok) {
      setState("ok");
    } else {
      setState("error");
      setError(result.error);
      setFields(result.fields ?? {});
    }
  }

  if (state === "ok") return <p className="notice ok">Thank you. We have your message and will reply within two working days.</p>;
  return (
    <form className="contact" onSubmit={onSubmit}>
      <label>Name<input name="name" required maxLength={120} autoComplete="name" /></label>
      <label>Email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <label>Company (optional)<input name="company" maxLength={160} autoComplete="organization" /></label>
      <label>Stream
        <select name="stream" defaultValue={streams[0].slug}>
          {streams.map((s) => <option key={s.slug} value={s.slug}>{s.name}: {s.tagline}</option>)}
        </select>
      </label>
      <label>Message<textarea name="message" required rows={6} maxLength={4000} defaultValue={project ? `About ${project}: ` : ""} /></label>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="consent">
        <input type="checkbox" name="consent" required />
        I agree that ZAIN LABS stores my details to answer this request (see the privacy notice). I can withdraw at any time.
      </label>
      {state === "error" && (
        <div className="notice err" role="alert">
          <p>{error}</p>
          {Object.keys(fields).length > 1 && (
            <ul>{Object.entries(fields).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
          )}
        </div>
      )}
      <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send message →"}</button>
    </form>
  );
}
