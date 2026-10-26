"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { api, toast } from "@/lib/client";
import { Button, Field, Input, Select, Spinner, money } from "@/components/ui";

interface Pack { id: string; code: string; name: string; credits: number; price_minor: number; currency: string; badge: string | null }
interface Quote { listMinor: number; discountMinor: number; taxableMinor: number; bonusCredits: number; couponMessage?: string; tax: { cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number } }

export function BuyPacks({ packs, mode, defaults, states, email }: { packs: Pack[]; mode: "razorpay" | "sandbox" | "off"; defaults: { name: string; gstin: string; state: string }; states: [string, string][]; email: string }) {
  const router = useRouter();
  const [pick, setPick] = useState<string>(packs.find((p) => p.badge === "Most picked")?.id ?? packs[0]?.id);
  const [coupon, setCoupon] = useState("");
  const [gstin, setGstin] = useState(defaults.gstin);
  const [buyer, setBuyer] = useState(defaults.name);
  const [state, setState] = useState(defaults.state || "07");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGst, setShowGst] = useState(!!defaults.gstin);

  useEffect(() => {
    if (!pick) return;
    const tm = setTimeout(() => {
      api<{ quote: Quote }>("/api/checkout", { method: "POST", json: { packId: pick, couponCode: coupon || null, buyerGstin: gstin.length === 15 ? gstin : null, buyerStateCode: state, previewOnly: true } })
        .then((r) => setQuote(r.quote)).catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(tm);
  }, [pick, coupon, gstin, state]);

  async function loadRazorpay() {
    if (window.Razorpay) return;
    await new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => res();
      s.onerror = () => rej(new Error("Couldn't load the payment window. Check your connection."));
      document.body.appendChild(s);
    });
  }

  async function buy() {
    setBusy(true);
    try {
      const r = await api<{ mode: string; orderId: string; razorpayOrderId?: string; keyId?: string; amount: number; currency: string; name?: string; description?: string }>("/api/checkout", {
        method: "POST", json: { packId: pick, couponCode: coupon || null, buyerName: buyer || null, buyerGstin: gstin || null, buyerStateCode: state },
      });
      if (r.mode === "sandbox") {
        await api("/api/checkout/sandbox", { method: "POST", json: { orderId: r.orderId } });
        router.push("/app/wallet?paid=1");
        router.refresh();
        return;
      }
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: r.keyId, order_id: r.razorpayOrderId, amount: r.amount, currency: r.currency, name: r.name, description: r.description,
        prefill: { email, name: buyer }, theme: { color: "#141310" },
        handler: async (resp: Record<string, string>) => {
          try {
            await api("/api/checkout/verify", { method: "POST", json: resp });
            router.push("/app/wallet?paid=1");
            router.refresh();
          } catch {
            toast("Payment received. Credits will appear in a minute.");
            setTimeout(() => router.refresh(), 5000);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", () => { toast("Payment didn't go through. You weren't charged.", true); setBusy(false); });
      rzp.open();
    } catch (e) {
      toast((e as Error).message, true);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {packs.map((p) => {
          const on = pick === p.id;
          return (
            <button key={p.id} type="button" onClick={() => setPick(p.id)} aria-pressed={on}
              className={clsx("relative rounded-xl border p-5 text-left transition-all", on ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink")}>
              {p.badge && <span className={clsx("absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium", on ? "bg-accent text-white" : "bg-accent/10 text-accent-ink")}>{p.badge}</span>}
              <div className="eyebrow" style={on ? { color: "#f4f1ea99" } : undefined}>{p.name}</div>
              <div className="display mt-2 text-5xl">{p.credits}</div>
              <div className={clsx("text-sm", on ? "text-paper/70" : "text-mute")}>credits</div>
              <div className="mt-4 font-medium">{money(p.price_minor, p.currency)}</div>
              <div className={clsx("frame-no", on && "!text-paper/60")}>{money(Math.round(p.price_minor / p.credits), p.currency)} per image</div>
            </button>
          );
        })}
      </div>
      <div className="space-y-4 rounded-xl border border-line bg-card p-5">
        <Field label="Coupon code" error={quote?.couponMessage}><Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Optional" /></Field>
        <button type="button" className="text-sm underline" onClick={() => setShowGst(!showGst)}>{showGst ? "Hide GST details" : "Add GSTIN for a business invoice"}</button>
        {showGst && (
          <div className="space-y-3">
            <Field label="Business name"><Input value={buyer} onChange={(e) => setBuyer(e.target.value)} /></Field>
            <Field label="GSTIN"><Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))} placeholder="07ABCDE1234F1Z5" /></Field>
          </div>
        )}
        {!gstin && (
          <Field label="Your state" hint="Decides whether CGST+SGST or IGST applies.">
            <Select value={state} onChange={(e) => setState(e.target.value)}>{states.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>
          </Field>
        )}
        {quote && (
          <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-mute">Pack</dt><dd>{money(quote.listMinor)}</dd></div>
            {quote.discountMinor > 0 && <div className="flex justify-between text-good"><dt>Discount</dt><dd>−{money(quote.discountMinor)}</dd></div>}
            {quote.bonusCredits > 0 && <div className="flex justify-between text-good"><dt>Bonus credits</dt><dd>+{quote.bonusCredits}</dd></div>}
            {quote.tax.cgstPaise > 0 && <div className="flex justify-between"><dt className="text-mute">CGST 9%</dt><dd>{money(quote.tax.cgstPaise)}</dd></div>}
            {quote.tax.sgstPaise > 0 && <div className="flex justify-between"><dt className="text-mute">SGST 9%</dt><dd>{money(quote.tax.sgstPaise)}</dd></div>}
            {quote.tax.igstPaise > 0 && <div className="flex justify-between"><dt className="text-mute">IGST 18%</dt><dd>{money(quote.tax.igstPaise)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-2 text-base font-medium"><dt>Total</dt><dd>{money(quote.tax.totalPaise)}</dd></div>
          </dl>
        )}
        <Button variant="accent" className="w-full" disabled={busy || mode === "off" || !pick} onClick={buy}>
          {busy ? <Spinner /> : mode === "sandbox" ? "Complete sandbox purchase" : "Pay with UPI, card or netbanking"}
        </Button>
        <p className="text-center text-xs text-mute">Secure payment by Razorpay. Credits are added as soon as payment succeeds.</p>
      </div>
    </div>
  );
}
