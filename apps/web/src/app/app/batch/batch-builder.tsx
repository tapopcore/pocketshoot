"use client";
/* eslint-disable @next/next/no-img-element -- static demo photos and signed URLs */
import { ReferenceViewer } from "@/components/reference-viewer";
import { FitImg } from "@/components/fit-img";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import clsx from "clsx";
import { Check, FileSpreadsheet, Minus, Plus } from "lucide-react";
import { CATEGORIES, PACK_SIZE, SHOOT_STYLES, isCategoryId, type CategoryId, type OutputId, type PackId, type ShootStyleId } from "@packshot/core";
import { api, newKey, toast, uploadFiles } from "@/lib/client";
import { Button, Field, Input, Notice, Spinner } from "@/components/ui";

interface P { id: string; name: string; category: string; coverUrl: string | null; sku: string | null }

export function BatchBuilder({ products, balance, creativeEnabled, brandKits, creditsPerImage=1 }: { creditsPerImage?:number; products: P[]; balance: number; creativeEnabled: boolean; brandKits: { id: string; name: string; palette: string[] }[] }) {
  const router = useRouter();
  const requestKey=useRef(newKey()),submitLock=useRef(false);
  const [photoOpen,setPhotoOpen]=useState<string|null>(null);
  const [list, setList] = useState(products);
  const [sel, setSel] = useState<string[]>([]);
  const [name, setName] = useState(`Batch ${new Date().toLocaleDateString("en-IN")}`);
  const [kind, setKind] = useState<PackId | ShootStyleId>("studio");
  const [count, setCount] = useState(2), [output, setOutput] = useState<OutputId>("square");
  const isPack = kind === "studio" || kind === "variety";
  const perProduct = isPack ? PACK_SIZE : count;
  const [busy, setBusy] = useState<string | null>(null);
  const [csvLog, setCsvLog] = useState<string[]>([]);
  const csv = useRef<HTMLInputElement>(null);
  const imgs = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const needed = sel.length * perProduct * creditsPerImage;

  async function importCsv(images: FileList | null) {
    if (!rows || !images) return;
    const byName = new Map(Array.from(images).map((f) => [f.name.toLowerCase(), f]));
    const log: string[] = [];
    setBusy("Importing products");
    const created: P[] = [];
    for (const r of rows) {
      const files = ["image", "image_2", "image_3"].map((k) => r[k]?.trim().toLowerCase()).filter(Boolean).map((n) => byName.get(n!)).filter(Boolean) as File[];
      if (!r.name || files.length === 0) { log.push(`Skipped ${r.name || r.sku || "a row"}: no matching photo file`); continue; }
      try {
        const keys = await uploadFiles(files);
        const category = isCategoryId(r.category?.trim()) ? (r.category.trim() as CategoryId) : "other";
        const res = await api<{ productId: string }>("/api/products", { method: "POST", json: { name: r.name.trim(), sku: r.sku?.trim() || null, category, locks: CATEGORIES[category].defaultLocks, uploads: keys.map((k, i) => ({ key: k, viewType: i === 0 ? "front" : "angle" })) } });
        created.push({ id: res.productId, name: r.name, category, coverUrl: URL.createObjectURL(files[0]), sku: r.sku ?? null });
        log.push(`Added ${r.name}`);
      } catch (e) { log.push(`${r.name}: ${(e as Error).message}`); }
      setCsvLog([...log]);
    }
    setList([...created, ...list]);
    setSel((s) => [...created.map((c) => c.id), ...s]);
    setRows(null);
    setBusy(null);
  }

  async function start() {
    if(submitLock.current)return;submitLock.current=true;
    const intent=JSON.stringify({products:[...sel].sort(),kind,output,count:perProduct});
    try{const prior=JSON.parse(sessionStorage.getItem("pocketshoot:batch-intent")??"null");if(prior?.intent===intent)requestKey.current=prior.key;else sessionStorage.setItem("pocketshoot:batch-intent",JSON.stringify({intent,key:requestKey.current=newKey()}));}catch{}
    setBusy("Starting");
    try {
      const r = await api<{ batchId: string; results: { error?: string }[] }>("/api/batch", {
        method: "POST",
        json: { name, productIds: sel, mode: "preserve", ...(isPack ? { pack: kind } : { shootStyle: kind, style: SHOOT_STYLES[kind as ShootStyleId].scene }), output, countPerProduct: perProduct, brandKitId: brandKits[0]?.id ?? null, quotedCredits:needed, batchKey: requestKey.current },
      });
      const failed = r.results.filter((x) => x.error).length;
      toast(failed ? `Started with ${failed} problem(s). Check the library.` : `Batch started: ${sel.length} products`);
      try{sessionStorage.removeItem("pocketshoot:batch-intent");}catch{}
      router.push("/app/shoots");
    } catch (e) { toast((e as Error).message, true); setBusy(null); submitLock.current=false; }
  }

  return (
    <div className="batch-builder space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="eyebrow">1 · Choose products ({sel.length} selected)</div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSel(sel.length === list.length ? [] : list.map((p) => p.id))}>{sel.length === list.length ? "Select none" : "Select all"}</Button>
            <Button size="sm" variant="outline" onClick={() => csv.current?.click()}><FileSpreadsheet size={15} /> Import CSV</Button>
          </div>
        </div>
        <input ref={csv} type="file" accept=".csv,text/csv" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) Papa.parse<Record<string, string>>(f, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase(), complete: (r) => setRows(r.data.slice(0, 200)) });
          e.target.value = "";
        }} />
        {rows && (
          <Notice className="mb-4">
            Found {rows.length} rows. Now choose the photo files named in the <code>image</code> column (and optional <code>image_2</code>, <code>image_3</code>).
            <div className="mt-2"><Button size="sm" onClick={() => imgs.current?.click()}>Choose photos</Button></div>
          </Notice>
        )}
        <input ref={imgs} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => importCsv(e.target.files)} />
        {!rows && list.length === 0 && <Notice>No products yet. Import a CSV with columns <code>name, sku, category, image</code>, where category is one of: {Object.keys(CATEGORIES).join(", ")}.</Notice>}
        {csvLog.length > 0 && <ul className="mb-4 max-h-32 overflow-auto rounded-lg bg-paper-2 p-3 text-xs">{csvLog.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {list.map((p) => {
            const on = sel.includes(p.id);
            return (
              <div key={p.id} className="batch-product"><button type="button" aria-pressed={on} aria-label={p.name} onClick={() => setSel(on ? sel.filter((x) => x !== p.id) : [...sel, p.id])} className="text-left">
                <div className={clsx("relative aspect-square overflow-hidden rounded-lg border-2 bg-paper-2", on ? "border-accent" : "border-transparent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <FitImg src={p.coverUrl} />}
                  {on && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-white"><Check size={12} /></span>}
                </div>
                <div className="mt-2 line-clamp-2 text-sm">{p.name}</div>
              </button>{p.coverUrl&&<button type="button" className="batch-view link xs" onClick={()=>setPhotoOpen(p.coverUrl)} aria-label={"View original "+p.name}>View original</button>}</div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="eyebrow mb-4">2 · What every product gets</div>
        <div className="bl-kinds">
          {([["studio", "Studio pack", `${PACK_SIZE} white background photos`, ["/showcase/studio/front.webp", "/showcase/studio/three-quarter.webp", "/showcase/studio/high.webp", "/showcase/studio/rim.webp"]],
            ["variety", "Photo set", `${PACK_SIZE} different looks, picked per product`, ["/showcase/style-demo-0.webp", "/showcase/style-demo-2.webp", "/showcase/style-demo-4.webp", "/showcase/style-demo-5.webp"]]] as const).map(([id, t, sub, imgs]) => (
            <button key={id} type="button" aria-pressed={kind === id} className={clsx("bl-k", kind === id && "on")} onClick={() => setKind(id)}>
              <span className="bl-g">{imgs.map((src) => <img key={src} src={src} alt="" loading="lazy" className={id === "studio" ? "white" : ""} />)}</span>
              <span className="bl-t"><b>{t}</b><span>{sub}</span><em>{PACK_SIZE*creditsPerImage} credits per product</em></span>
            </button>))}
        </div>
        <div className="bl-sub">Or one look, 1 to 4 photos per product</div>
        <div className="bl-looks">
          {(["indoor", "outdoor", "model", "closeup", "graphic"] as const).map((id) => { const st = SHOOT_STYLES[id]; return (
            <button key={id} type="button" aria-pressed={kind === id} className={clsx("bl-l", kind === id && "on")} onClick={() => setKind(id)}>
              <span className="ph r11"><img src={"/showcase/style-demo-"+({indoor:0,outdoor:4,model:2,closeup:5,graphic:1}[id])+".webp"} alt="" loading="lazy" />{kind === id && <span className="tick"><Check size={14} /></span>}</span>
              <b>{st.title}</b><span>{st.subtitle}</span>
            </button>); })}
        </div>
        <div className="bl-opts">
          {!isPack && <div className="bl-count"><span>Photos per product</span><div className="qty"><button type="button" className="ib" aria-label="Fewer" disabled={count <= 1} onClick={() => setCount(count - 1)}><Minus size={18} /></button><b className="num">{count}</b><button type="button" className="ib" aria-label="More" disabled={count >= 4} onClick={() => setCount(count + 1)}><Plus size={18} /></button></div></div>}
          <div className="seg" role="group" aria-label="Size">{([["square", "Square"], ["portrait", "Portrait"], ["story", "Story"], ["landscape", "Wide"]] as const).map(([id, l]) => <button key={id} type="button" className={clsx(output === id && "on")} onClick={() => setOutput(id)}>{l}</button>)}</div>
        </div>
      </section>

      <section className="batch-checkout grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Batch name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <div className="text-right">
          <div className="text-sm text-mute">{sel.length} products × {perProduct} photos = <b className="text-ink">{needed} credits</b> (you have {balance})</div>
          <Button variant="accent" className="mt-2" disabled={!sel.length || needed > balance || !!busy} onClick={start}>{busy ? <><Spinner /> {busy}</> : `Shoot ${sel.length} products`}</Button>
        </div>
      </section>
      <p className="xs muted">All examples show the same demo bottle. Your selected products use their own reference photos. Studio packs keep a white background; photo sets vary the setting.</p>
      {photoOpen&&<ReferenceViewer photos={[{url:photoOpen,label:"Original product photo"}]} index={0} onIndex={()=>{}} onClose={()=>setPhotoOpen(null)}/>}
      {needed > balance && <Notice tone="bad">You need {needed - balance} more credits for this batch. <a className="underline" href="/app/wallet">Buy credits</a></Notice>}
    </div>
  );
}
