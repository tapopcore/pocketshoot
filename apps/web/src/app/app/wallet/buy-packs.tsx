"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { api, toast } from "@/lib/client";
import { Button, Field, Input, Select, Spinner, money } from "@/components/ui";

interface Pack { id: string; code: string; name: string; credits: number; price_minor: number; currency: string; badge: string | null }
interface Quote { listMinor: number; discountMinor: number; taxableMinor: number; bonusCredits: number; couponMessage?: string; tax: { cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number } }

export function BuyPacks({ packs, mode, defaults, states, email, initial }: { packs: Pack[]; mode: "razorpay" | "sandbox" | "off"; defaults: { name: string; gstin: string; state: string }; states: [string, string][]; email: string; initial?: string | null }) {
  const router = useRouter();
  const [pick, setPick] = useState<string>(packs.find((p) => p.code === initial)?.id ?? packs.find((p) => p.badge)?.id ?? packs[0]?.id);
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
        prefill: { email, name: buyer }, theme: { color: "#FC4A12" },
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

  const chosen = packs.find((p) => p.id === pick);
  return (
    <div className="buy card">
      <h2 className="h4">Buy more credits</h2>
      <div className="pl" role="radiogroup" aria-label="Credit packs">
        {packs.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className={clsx(pick === p.id && "on")} onClick={() => setPick(p.id)}>
            <i /><span className="t"><b>{p.name}{p.badge && <span className="pill sm lime-pill">{p.badge}</span>}</b><small>{p.credits} photos · {money(Math.round(p.price_minor / p.credits / 100) * 100, p.currency)} each</small></span><b className="num">{money(p.price_minor, p.currency)}</b>
          </button>
        ))}
      </div>
      <div className="lines">
        {quote ? <>
          {quote.discountMinor > 0 && <div className="good-t"><span>Discount</span><b>−{money(quote.discountMinor)}</b></div>}
          {quote.bonusCredits > 0 && <div className="good-t"><span>Bonus credits</span><b>+{quote.bonusCredits}</b></div>}
          <div><span>{money(quote.taxableMinor)} + {money(quote.tax.cgstPaise + quote.tax.sgstPaise + quote.tax.igstPaise)} GST</span><b>{money(quote.tax.totalPaise)}</b></div>
        </> : <div><span>Prices exclude 18% GST</span><b>{chosen ? money(chosen.price_minor, chosen.currency) : ""}</b></div>}
      </div>
      <button type="button" className="btn btn-lg btn-lime btn-block" style={{ marginTop: "var(--s3)" }} disabled={busy || mode === "off" || !pick} onClick={buy}>
        {busy ? <Spinner /> : mode === "sandbox" ? "Complete test purchase" : quote ? `Pay ${money(quote.tax.totalPaise)}` : "Pay with UPI, card or netbanking"}
      </button>
      <details className="more" open={showGst || !!coupon}>
        <summary>Coupon, GSTIN and state</summary>
        <div className="fields">
          <Field label="Coupon code" error={quote?.couponMessage}><Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Optional" /></Field>
          <Field label="Business name"><Input value={buyer} onChange={(e) => { setBuyer(e.target.value); setShowGst(true); }} placeholder="For a GST invoice" /></Field>
          <Field label="GSTIN"><Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))} placeholder="07ABCDE1234F1Z5" /></Field>
          {!gstin && <Field label="Your state" hint="Decides whether CGST and SGST or IGST applies."><Select value={state} onChange={(e) => setState(e.target.value)}>{states.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>}
        </div>
      </details>
      <p className="xs muted" style={{ textAlign: "center", marginTop: "var(--s3)" }}>Secure payment by Razorpay. Credits are added as soon as payment succeeds.</p>
    </div>
  );
}
