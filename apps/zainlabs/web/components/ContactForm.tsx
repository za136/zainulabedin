"use client";

import { useState } from "react";
import { streams } from "@zainlabs/content";

export function ContactForm({ project }: { project?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, consent: data.consent === "on", source: "web" }),
    }).catch(() => null);
    if (res?.ok) {
      setState("ok");
      e.currentTarget?.reset();
    } else {
      setState("error");
      setError((await res?.json().catch(() => null))?.error ?? "Network error. Please try again.");
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
      {state === "error" && <p className="notice err">{error}</p>}
      <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send message →"}</button>
    </form>
  );
}
