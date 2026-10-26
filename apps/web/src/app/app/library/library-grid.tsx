"use client";
import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, Download } from "lucide-react";
import { api, saveBlob, toast } from "@/lib/client";
import { Button, Select, Spinner } from "@/components/ui";

export function LibraryGrid({ assets }: { assets: { id: string; thumb: string | null; name: string; jobId: string; approved: boolean; review: boolean; ratio: string }[] }) {
  const [sel, setSel] = useState<string[]>([]);
  const [format, setFormat] = useState("jpg");
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {assets.map((a) => (
          <div key={a.id} className="group relative mb-4 break-inside-avoid">
            <Link href={`/app/jobs/${a.jobId}`} className="block overflow-hidden rounded-lg bg-paper-2" style={{ aspectRatio: a.ratio }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.thumb && <img src={a.thumb} alt={a.name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
            </Link>
            <button type="button" aria-label={sel.includes(a.id) ? "Deselect" : "Select"} onClick={() => toggle(a.id)}
              className={clsx("absolute left-2 top-2 grid size-6 place-items-center rounded-full border-2 transition-all", sel.includes(a.id) ? "border-accent bg-accent text-white" : "border-paper bg-ink/20 opacity-0 group-hover:opacity-100 max-lg:opacity-100")}>
              {sel.includes(a.id) && <Check size={13} />}
            </button>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-ink-2">{a.name}</span>
              {a.approved ? <span className="text-good">Approved</span> : a.review ? <span className="text-warn">Check</span> : null}
            </div>
          </div>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-2 rounded-full bg-ink p-2 pl-5 text-paper shadow-[var(--shadow-lift)] animate-rise lg:bottom-6">
          <span className="text-sm">{sel.length} selected</span>
          <div className="flex items-center gap-1">
            <Select value={format} onChange={(e) => setFormat(e.target.value)} className="!h-9 !w-20 !rounded-full !border-0 !bg-paper/10 !text-paper text-sm" aria-label="Format">
              <option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option>
            </Select>
            <Button size="sm" variant="accent" disabled={busy} onClick={async () => {
              setBusy(true);
              try { saveBlob(await api<Blob>("/api/assets/zip", { method: "POST", json: { ids: sel, format } }), "photos.zip"); } catch (e) { toast((e as Error).message, true); }
              setBusy(false);
            }}>{busy ? <Spinner /> : <Download size={15} />} ZIP</Button>
            <Button size="sm" variant="ghost" className="!text-paper" onClick={() => setSel([])}>Clear</Button>
          </div>
        </div>
      )}
    </>
  );
}
