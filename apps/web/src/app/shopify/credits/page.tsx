"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api, toast } from "@/lib/client";
import { Button, Notice, Spinner, money } from "@/components/ui";
import { useMe } from "../use-me";

interface Pack { id: string; name: string; credits: number; price_minor: number; currency: string; badge: string | null }

export default function ShopifyCreditsPage() {
  return <Suspense><ShopifyCredits /></Suspense>;
}

function ShopifyCredits() {
  const { me } = useMe();
  const params = useSearchParams();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { fetch("/api/packs?channel=shopify").then((r) => r.json()).then((r) => setPacks(r.packs ?? [])); }, []);
  const purchase = params.get("purchase");

  async function buy(packId: string) {
    setBusy(packId);
    try {
      const r = await api<{ confirmationUrl: string }>("/api/shopify/billing", { method: "POST", json: { packId } });
      window.open(r.confirmationUrl, "_top");
    } catch (e) { toast((e as Error).message, true); setBusy(null); }
  }

  if (!me) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  return (
    <div>
      <div className="eyebrow">No subscription</div>
      <h1 className="display text-4xl">Credits</h1>
      <p className="mt-1 text-sm text-mute">You have <b className="text-ink">{me.wallet.available}</b> credits. One credit makes one delivered image. Charges appear on your Shopify bill.</p>
      {purchase === "ok" && <Notice tone="good" className="mt-4">Thanks! Your credits are ready.</Notice>}
      {purchase === "declined" && <Notice tone="warn" className="mt-4">The charge wasn&apos;t approved, so nothing was billed.</Notice>}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {packs.map((p) => (
          <div key={p.id} className={clsx("rounded-xl border bg-card p-5", p.badge ? "border-ink" : "border-line")}>
            {p.badge && <div className="mb-2 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent-ink">{p.badge}</div>}
            <div className="eyebrow">{p.name}</div>
            <div className="display mt-1 text-5xl">{p.credits}</div>
            <div className="text-sm text-mute">credits</div>
            <div className="mt-3 font-medium">{money(p.price_minor, p.currency)}</div>
            <div className="frame-no">{money(Math.round(p.price_minor / p.credits), p.currency)} / image</div>
            <Button size="sm" className="mt-4 w-full" disabled={!!busy} onClick={() => buy(p.id)}>{busy === p.id ? <Spinner /> : "Buy"}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
