"use client";
import { FitImg } from "@/components/fit-img";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import clsx from "clsx";
import { Check, FileSpreadsheet } from "lucide-react";
import { CATEGORIES, isCategoryId, type CategoryId } from "@packshot/core";
import { api, newKey, toast, uploadFiles } from "@/lib/client";
import { Button, Field, Input, Notice, Spinner } from "@/components/ui";
import { ShootSetup, defaultChoices, type ShootChoices } from "@/components/shoot-setup";

interface P { id: string; name: string; category: string; coverUrl: string | null; sku: string | null }

export function BatchBuilder({ products, balance, creativeEnabled, brandKits }: { products: P[]; balance: number; creativeEnabled: boolean; brandKits: { id: string; name: string; palette: string[] }[] }) {
  const router = useRouter();
  const [list, setList] = useState(products);
  const [sel, setSel] = useState<string[]>([]);
  const [name, setName] = useState(`Batch ${new Date().toLocaleDateString("en-IN")}`);
  const [choices, setChoices] = useState<ShootChoices>({ ...defaultChoices("other"), count: 2, style: "pure_white" });
  const [busy, setBusy] = useState<string | null>(null);
  const [csvLog, setCsvLog] = useState<string[]>([]);
  const csv = useRef<HTMLInputElement>(null);
  const imgs = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const needed = sel.length * choices.count;
  const firstCat = (list.find((p) => p.id === sel[0])?.category ?? "other") as CategoryId;

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
    setBusy("Starting");
    try {
      const r = await api<{ batchId: string; results: { error?: string }[] }>("/api/batch", {
        method: "POST",
        json: { name, productIds: sel, mode: choices.mode, style: choices.style, output: choices.output, countPerProduct: choices.count, brandKitId: choices.brandKitId, batchKey: newKey() },
      });
      const failed = r.results.filter((x) => x.error).length;
      toast(failed ? `Started with ${failed} problem(s). Check the library.` : `Batch started: ${sel.length} products`);
      router.push("/app/library");
    } catch (e) { toast((e as Error).message, true); setBusy(null); }
  }

  return (
    <div className="space-y-10">
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
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {list.map((p) => {
            const on = sel.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => setSel(on ? sel.filter((x) => x !== p.id) : [...sel, p.id])} className="text-left">
                <div className={clsx("relative aspect-square overflow-hidden rounded-lg border-2 bg-paper-2", on ? "border-accent" : "border-transparent")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <FitImg src={p.coverUrl} />}
                  {on && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-white"><Check size={12} /></span>}
                </div>
                <div className="mt-1 truncate text-xs">{p.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="eyebrow mb-4">2 · One look for all</div>
        <ShootSetup value={choices} onChange={setChoices} category={firstCat} creativeEnabled={creativeEnabled} brandKits={brandKits} maxImages={4} countLabel="Images per product" />
      </section>

      <section className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Batch name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
        <div className="text-right">
          <div className="text-sm text-mute">{sel.length} products × {choices.count} = <b className="text-ink">{needed} credits</b> (you have {balance})</div>
          <Button variant="accent" className="mt-2" disabled={!sel.length || needed > balance || !!busy} onClick={start}>{busy ? <><Spinner /> {busy}</> : `Shoot ${sel.length} products`}</Button>
        </div>
      </section>
      {needed > balance && <Notice tone="bad">You need {needed - balance} more credits for this batch. <a className="underline" href="/app/wallet">Buy credits</a></Notice>}
    </div>
  );
}
