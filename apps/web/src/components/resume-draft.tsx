"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shows an unfinished shoot saved in this browser. Nothing is charged for drafts. */
export function ResumeDraft({ scope }: { scope: string }) {
  const [d, setD] = useState<{ name: string; step: string; at: number } | null>(null);
  useEffect(() => { try { const x = JSON.parse(localStorage.getItem("pocketshoot:draft:v2:" + scope) || "null"); if (x?.productId && x?.profile && Date.now() - x.updatedAt < 30 * 86400000) setD({ name: String(x.name || "Your product"), step: String(x.step), at: x.updatedAt }); } catch { /* storage unavailable */ } }, [scope]);
  if (!d) return null;
  const mins = Math.round((Date.now() - d.at) / 60000);
  const when = mins < 60 ? `${Math.max(1, mins)} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hours ago` : `${Math.round(mins / 1440)} days ago`;
  const left = d.step === "review" ? "Ready to create" : d.step === "looks" ? "Style not chosen yet" : "Details not checked yet";
  return (
    <div className="draft card">
      <span className="ico" aria-hidden><ArrowRight /></span>
      <div style={{ flex: 1, minWidth: 0 }}><span className="pill warn sm">Draft</span><h3 className="h5" style={{ marginTop: 8 }}>{d.name}</h3><p className="sm" style={{ marginTop: 2 }}>{left}</p><p className="xs muted" style={{ marginTop: 2 }}>Saved {when}. Nothing charged.</p></div>
      <Link href="/app/new" className="btn btn-dark btn-sm">Continue</Link>
    </div>
  );
}
