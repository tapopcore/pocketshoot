"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

/** Shown instead of a blank screen if a page fails to load. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="note" role="alert" style={{ marginTop: "var(--s6)", display: "grid", gap: 12, justifyItems: "start" }}>
      <b>This page didn&apos;t load.</b>
      <span className="sm muted">Your photos and credits are safe. Check your connection and try again.</span>
      <button type="button" className="btn btn-lime" onClick={() => { reset(); router.refresh(); }}><RotateCw size={16} />Try again</button>
    </div>
  );
}
