/* eslint-disable @next/next/no-img-element -- Signed storage URLs. */
"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Camera, Loader2, Upload } from "lucide-react";
import { setPendingFiles } from "@/lib/photo-client";

function usePick() {
  const router = useRouter();
  return (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name));
    if (!list.length) return;
    setPendingFiles(list.slice(0, 6));
    router.push("/app/new");
  };
}

/** The start box on Home: drop or choose up to 6 photos of one product, then continue in the create flow. */
export function StartBox({ products, canEdit }: { products: { id: string; name: string; coverUrl: string | null }[]; canEdit: boolean }) {
  const go = usePick();
  const input = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return <>
    <div className={clsx("start", over && "over")} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (canEdit) go(e.dataTransfer.files); }}>
      <div className="l"><span className="ico dark"><Upload /></span><div><h2 className="h4">Start a new shoot</h2><p className="sm muted" style={{ marginTop: 4 }}>Drop photos of one product here, from up to 6 angles.</p></div></div>
      <div className="row act">
        <button type="button" className="btn btn-soft m-only" disabled={!canEdit} onClick={() => camera.current?.click()}><Camera />Take photo</button>
        <button type="button" className="btn btn-lime" disabled={!canEdit} onClick={() => input.current?.click()}>Choose photos</button>
      </div>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => go(e.target.files)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => go(e.target.files)} />
    </div>
    {products.length > 0 && <div className="reuse"><span className="sm muted nowrap">Or use a saved product</span><div className="pills">{products.map((p) =>
      <Link key={p.id} href={"/app/new?product=" + p.id} className="pill line prod"><span className="ph">{p.coverUrl && <img src={p.coverUrl} alt="" />}</span>{p.name}</Link>)}</div></div>}
  </>;
}

/** First visit: start from the user's own photos, or from our sample bottle to see how it works. */
export function FirstActions({ canEdit }: { canEdit: boolean }) {
  const go = usePick();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function sample() {
    setBusy(true);
    try { const blob = await (await fetch("/sample/peach-iced-tea.webp")).blob(); go([new File([blob], "peach-iced-tea.webp", { type: "image/webp" })]); }
    catch { setBusy(false); }
  }
  return <div className="row acts">
    <button type="button" className="btn btn-lg btn-lime" disabled={!canEdit} onClick={() => input.current?.click()}><Upload />Upload photos</button>
    <button type="button" className="btn btn-lg btn-soft" disabled={!canEdit || busy} onClick={sample}>{busy ? <Loader2 className="animate-spin" /> : null}Try a sample product</button>
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => go(e.target.files)} />
  </div>;
}
