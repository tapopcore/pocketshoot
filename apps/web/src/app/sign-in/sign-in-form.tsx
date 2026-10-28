"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { browserSupabase } from "@/lib/supabase-browser";
import { Spinner } from "@/components/ui";

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const supabase = browserSupabase();
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
      if (error) setError(/rate limit|too many/i.test(error.message) ? "We've hit the email sending limit. Try again in a while." : error.message);
      else { setStage("code"); setCooldown(60); }
    } catch { setError("We couldn't reach sign-in. Check your connection and try again."); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) setError("That code didn't work or expired. Check it, or request a new code.");
      else window.location.href = next;
    } catch { setError("We couldn't verify the code. Check your connection and retry."); } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) {
      setBusy(false);
      setError("Google sign-in isn't available right now. Use your email instead.");
    }
  }

  /** Six boxes that behave like one field: typing advances, backspace goes back, pasting fills all. */
  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) { const c = d.slice(0, 6); setCode(c); boxes.current[Math.min(c.length, 5)]?.focus(); return; }
    const arr = Array.from({ length: 6 }, (_, n) => code[n] ?? "");
    arr[i] = d;
    setCode(arr.join(""));
    if (d && i < 5) boxes.current[i + 1]?.focus();
  }

  if (stage === "code") return (
    <form onSubmit={verify}>
      <button type="button" className="link sm" style={{ color: "var(--muted)" }} onClick={() => { setStage("email"); setCode(""); }}><ArrowLeft />Use a different email</button>
      <h1 className="h2" style={{ fontSize: 40, marginTop: "var(--s5)" }}>Check your email</h1>
      <p className="body muted" style={{ marginTop: "var(--s3)" }}>We sent a 6-digit code to <b style={{ color: "var(--ink)" }}>{email}</b>. You can also tap the link in the email.</p>
      <div className="otp">{[0, 1, 2, 3, 4, 5].map((i) => (
        <input key={i} ref={(el) => { boxes.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`Digit ${i + 1}`} value={code[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus(); }} autoFocus={i === 0} />
      ))}</div>
      <button className="btn btn-lg btn-lime btn-block" style={{ marginTop: "var(--s5)" }} disabled={busy || code.length < 6}>{busy ? <Spinner /> : "Log in"}</button>
      <div className="between sm" style={{ marginTop: "var(--s4)" }}><span className="muted">No email? Check your spam folder.</span><button type="button" className="link" disabled={busy || cooldown > 0} onClick={sendLink} style={{ opacity: cooldown > 0 ? 0.6 : 1 }}>{cooldown > 0 ? `Resend in 0:${String(cooldown).padStart(2, "0")}` : "Send a new code"}</button></div>
      {error && <p role="alert" className="sm" style={{ color: "var(--bad)", marginTop: "var(--s3)" }}>{error}</p>}
    </form>
  );

  const googleOn = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1";
  return (
    <div>
      <h1 className="h2" style={{ fontSize: 40 }}>Log in or sign up</h1>
      <p className="body muted" style={{ marginTop: "var(--s3)" }}>New here? We will create your account and add 2 free photos.</p>
      {googleOn && <>
        <button className="btn btn-lg btn-line btn-block" style={{ marginTop: "var(--s6)" }} onClick={google} disabled={busy} type="button">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <div className="or"><span>or use your email</span></div>
      </>}
      <form onSubmit={sendLink} style={{ marginTop: googleOn ? 0 : "var(--s6)" }}>
        <label className="field"><span className="label">Email address</span><input className="input" type="email" required autoComplete="email" placeholder="you@yourbrand.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="btn btn-lg btn-lime btn-block" style={{ marginTop: "var(--s4)" }} disabled={busy || !email || cooldown > 0}>{busy ? <Spinner /> : cooldown > 0 ? `Try again in ${cooldown}s` : "Send me a login code"}</button>
      </form>
      {error && <p role="alert" className="sm" style={{ color: "var(--bad)", marginTop: "var(--s3)" }}>{error}</p>}
    </div>
  );
}
