"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { api, newKey, toast } from "@/lib/client";
import { Badge, Button, Input, Notice, Spinner } from "@/components/ui";
import { ShootSetup, defaultChoices, type ShootChoices } from "@/components/shoot-setup";
import { useMe } from "./use-me";

interface SP {
  id: string; title: string; status: string; productType: string; featuredImage: { url: string } | null; images: { url: string }[];
  localProductId: string | null; shots: number; pushed: number;
}

export default function ShopifyHome() {
  const router = useRouter();
  const { me, error, reload } = useMe();
  const [products, setProducts] = useState<SP[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [setup, setSetup] = useState(false);
  const [choices, setChoices] = useState<ShootChoices>({ ...defaultChoices("other"), count: 2, style: "pure_white" });
  const [busy, setBusy] = useState<string | null>(null);
  const key = useRef(newKey());

  const load = useCallback(async (reset: boolean, query: string, after: string | null) => {
    setLoading(true);
    try {
      const r = await api<{ products: SP[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }>(`/api/shopify/products?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(after && !reset ? { after } : {}) })}`);
      setProducts((p) => (reset ? r.products : [...p, ...r.products]));
      setCursor(r.pageInfo.endCursor);
      setMore(r.pageInfo.hasNextPage);
    } catch (e) { toast((e as Error).message, true); }
    setLoading(false);
  }, []);

  useEffect(() => { if (me) load(true, "", null); }, [me, load]);

  async function shoot() {
    const needed = sel.length * choices.count;
    if (me && needed > me.wallet.available) { toast(`You need ${needed} credits and have ${me.wallet.available}.`, true); return; }
    try {
      setBusy("Importing product photos");
      const { results } = await api<{ results: { shopifyId: string; productId?: string; error?: string }[] }>("/api/shopify/import", { method: "POST", json: { productIds: sel } });
      const ok = results.filter((r) => r.productId);
      results.filter((r) => r.error).forEach((r) => toast(`${products.find((p) => p.id === r.shopifyId)?.title}: ${r.error}`, true));
      if (!ok.length) { setBusy(null); return; }
      setBusy("Starting shoot");
      if (ok.length === 1) {
        const j = await api<{ jobId: string }>("/api/jobs", { method: "POST", json: { productId: ok[0].productId, mode: choices.mode, style: choices.style, output: choices.output, count: choices.count, customBrief: choices.customBrief || null, idempotencyKey: key.current } });
        router.push(`/shopify/jobs/${j.jobId}`);
      } else {
        await api("/api/batch", { method: "POST", json: { name: `Shopify batch ${new Date().toLocaleDateString()}`, productIds: ok.map((o) => o.productId), mode: choices.mode, style: choices.style, output: choices.output, countPerProduct: Math.min(4, choices.count), batchKey: key.current } });
        toast(`Shooting ${ok.length} products`);
        router.push("/shopify/library");
      }
    } catch (e) { toast((e as Error).message, true); setBusy(null); key.current = newKey(); }
  }

  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!me) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Your store</div>
          <h1 className="display text-4xl">Pick products to reshoot</h1>
          <p className="mt-1 text-sm text-mute">We use the product&apos;s existing photos as the reference and keep your label and logo exact. New images go back to the product when you approve them.</p>
        </div>
        <button onClick={() => router.push("/shopify/credits")} className="rounded-full border border-line bg-card px-4 py-2 text-sm">
          <b className="tabular-nums">{me.wallet.available}</b> credits · Buy more
        </button>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); load(true, q, null); }} className="mb-5 flex max-w-md gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" />
        <Button variant="outline" aria-label="Search"><Search size={16} /></Button>
      </form>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((p) => {
          const on = sel.includes(p.id);
          const noImg = p.images.length === 0;
          return (
            <button key={p.id} disabled={noImg} onClick={() => setSel(on ? sel.filter((x) => x !== p.id) : [...sel, p.id])} className={clsx("text-left", noImg && "opacity-40")}>
              <div className={clsx("relative aspect-square overflow-hidden rounded-lg border-2 bg-paper-2", on ? "border-accent" : "border-transparent")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.featuredImage && <img src={`${p.featuredImage.url}${p.featuredImage.url.includes("?") ? "&" : "?"}width=400`} alt="" className="size-full object-cover" />}
                {on && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-white"><Check size={14} /></span>}
                {p.shots > 0 && <span className="absolute bottom-2 left-2"><Badge tone="good" className="!bg-white/90">{p.shots} shots{p.pushed ? ` · ${p.pushed} live` : ""}</Badge></span>}
              </div>
              <div className="mt-1.5 truncate text-sm font-medium">{p.title}</div>
              <div className="frame-no">{noImg ? "No image" : `${p.images.length} image${p.images.length > 1 ? "s" : ""}`}{p.status !== "ACTIVE" ? ` · ${p.status.toLowerCase()}` : ""}</div>
            </button>
          );
        })}
      </div>
      {loading && <div className="mt-6 flex justify-center"><Spinner /></div>}
      {more && !loading && <div className="mt-8 flex justify-center"><Button variant="ghost" onClick={() => load(false, q, cursor)}>Load more</Button></div>}

      {sel.length > 0 && !setup && (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-center justify-between rounded-full bg-ink p-2 pl-5 text-paper shadow-[var(--shadow-lift)] animate-rise">
          <span className="text-sm">{sel.length} selected</span>
          <div className="flex gap-1"><Button size="sm" variant="ghost" className="!text-paper" onClick={() => setSel([])}>Clear</Button><Button size="sm" variant="accent" onClick={() => setSetup(true)}>Choose a look</Button></div>
        </div>
      )}

      {setup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
          <div className="mx-auto max-w-4xl px-4 py-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="display text-4xl">{sel.length === 1 ? products.find((p) => p.id === sel[0])?.title : `${sel.length} products`}</h2>
              <Button variant="ghost" onClick={() => setSetup(false)}>Back</Button>
            </div>
            <ShootSetup value={choices} onChange={setChoices} category="other" creativeEnabled={me.features.creativeMode} maxImages={sel.length > 1 ? 4 : me.policy.maxImagesPerJob} countLabel={sel.length > 1 ? "Images per product" : undefined} />
            <div className="sticky bottom-4 mt-10 flex items-center justify-between rounded-full border border-line bg-paper/95 p-2 pl-5 backdrop-blur">
              <span className="text-sm">{sel.length * choices.count} credits · you have {me.wallet.available}</span>
              <Button variant="accent" disabled={!!busy} onClick={shoot}>{busy ? <><Spinner /> {busy}</> : "Start shoot"}</Button>
            </div>
            {me.wallet.available < sel.length * choices.count && <Notice tone="bad" className="mt-4">Not enough credits. <button className="underline" onClick={() => { reload(); router.push("/shopify/credits"); }}>Buy credits</button></Notice>}
          </div>
        </div>
      )}
    </div>
  );
}
