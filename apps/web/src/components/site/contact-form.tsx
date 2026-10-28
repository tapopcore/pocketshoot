"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const TOPICS: [string, string][] = [["photo", "A photo"], ["payment", "Payment"], ["bulk", "Bulk work"], ["other", "Other"]];

export function ContactForm() {
  const [topic, setTopic] = useState("photo");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending"); setError(null);
    const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: f.get("name"), email: f.get("email"), message: f.get("message"), website: f.get("website"), topic }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) { setError(data?.error ?? "We couldn't send that. Try again in a minute."); setState("idle"); return; }
    setState("sent");
  }
  if (state === "sent") return (
    <div className="card pl" style={{ borderRadius: "var(--r4)", textAlign: "center" }}><CheckCircle2 style={{ width: 48, height: 48, color: "var(--good)", margin: "0 auto" }} /><h2 className="h3" style={{ marginTop: "var(--s4)" }}>Message sent</h2><p className="body muted" style={{ marginTop: 6 }}>Thanks. We reply within one working day.</p></div>
  );
  return (
    <form className="card pl" style={{ borderRadius: "var(--r4)" }} onSubmit={submit}>
      <h2 className="h3">Send us a message</h2>
      <div className="fm">
        <div className="gx c2" style={{ gap: "var(--s3)" }}>
          <label className="field"><span className="label">Your name</span><input className="input" name="name" required maxLength={120} placeholder="Your full name" autoComplete="name" /></label>
          <label className="field"><span className="label">Email</span><input className="input" name="email" type="email" required placeholder="you@yourbrand.com" autoComplete="email" /></label>
        </div>
        <div className="field"><span className="label">Topic</span><div className="pills">{TOPICS.map(([k, l]) => <button type="button" key={k} className={`pill${topic === k ? " on" : ""}`} onClick={() => setTopic(k)} aria-pressed={topic === k}>{l}</button>)}</div></div>
        <label className="field"><span className="label">Message</span><textarea className="input" name="message" required minLength={5} maxLength={4000} placeholder="Tell us what happened. A link to the shoot helps." /></label>
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
        {error && <p className="sm" style={{ color: "var(--bad)" }}>{error}</p>}
        <button className="btn btn-lg btn-lime btn-block" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send message"}</button>
      </div>
    </form>
  );
}
