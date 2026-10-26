"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase-browser";
import { Button, Input, Spinner } from "@/components/ui";

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = browserSupabase();
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(/rate limit|too many/i.test(error.message) ? "We've hit the email sending limit. Try again in a while." : error.message);
    else setStage("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("That code didn't work. Check it or use the link in the email.");
    else window.location.href = next;
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) {
      setBusy(false);
      setError("Google sign-in isn't available right now. Use your email instead.");
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1" && <>
      <Button variant="outline" className="w-full" onClick={google} disabled={busy} type="button">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </Button>
      <div className="flex items-center gap-3 text-xs text-mute"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      </>}
      {stage === "email" ? (
        <form onSubmit={sendLink} className="space-y-3">
          <Input type="email" required autoComplete="email" placeholder="you@yourbrand.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <Button className="w-full" disabled={busy || !email}>{busy ? <Spinner /> : "Email me a sign-in code"}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-sm text-ink-2">We sent a code and a link to <b>{email}</b>. Enter the code, or tap the link in the email.</p>
          <Input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code" className="text-center tracking-[0.4em]" />
          <Button className="w-full" disabled={busy || code.length < 6}>{busy ? <Spinner /> : "Sign in"}</Button>
          <button type="button" className="w-full text-sm text-mute underline" onClick={() => setStage("email")}>Use a different email</button>
        </form>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
