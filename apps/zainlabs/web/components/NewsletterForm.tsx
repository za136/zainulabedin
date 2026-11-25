"use client";

import { useState } from "react";
import { api } from "@/lib/api";

/** Newsletter signup. The backend sends a confirmation email (double opt-in, required in Germany). */
export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const form = new FormData(e.currentTarget);
    const result = await api.subscribe({
      email: String(form.get("email") ?? "").trim(),
      consent: form.get("consent") === "on",
      source: "web",
      website: String(form.get("website") ?? ""),
    });
    if (result.ok) setState("ok");
    else {
      setState("error");
      setError(result.error);
    }
  }

  if (state === "ok")
    return <p className="notice ok">Almost done: please click the link in the email we just sent you to confirm.</p>;
  return (
    <form className="contact" onSubmit={onSubmit}>
      <label>Email<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="consent">
        <input type="checkbox" name="consent" required />
        I want to receive the ZAIN LABS newsletter (new projects, releases). I can unsubscribe at any time with the link in every email.
      </label>
      {state === "error" && <p className="notice err" role="alert">{error}</p>}
      <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Subscribe →"}</button>
    </form>
  );
}
