import { ShieldCheck, RefreshCw, Receipt } from "lucide-react";
import { webPacks, shopifyPacks } from "@/lib/public";
import { PricingTable } from "@/components/site/pricing-table";

export const metadata = { title: "Pricing: AI Product Photos from ₹50", description: "Pay per photo with no subscription. Product photo packs from ₹499 for 5 photos to ₹12,499 for 250 photos. 2 free photos to start." };
export const revalidate = 300;

export default async function Pricing() {
  const [web, shopify] = await Promise.all([webPacks(), shopifyPacks()]);
  return (
    <div className="pg-pricing">
      <section className="phero c"><div className="wrap"><span className="kicker"><i />Pricing</span><h1 className="h1">Pay per photo. <span className="it">No subscription.</span></h1><p className="lead">Start with 2 free photos, then buy credits whenever you need more.</p></div>
        <PricingTable web={web} shopify={shopify} />
      </section>
      <section style={{ padding: "var(--s4) 0 var(--section)" }}><div className="wrap">
        <div className="gx c3" style={{ gap: "var(--s4)" }}>
          {[[ShieldCheck, "Pay only for good photos", "If a photo fails our check, the credit goes straight back to you."], [RefreshCw, "First remake is free", "Not quite right? Remake any photo once within 7 days at no cost."], [Receipt, "GST invoice every time", "Download invoices from your account for every purchase."]].map(([I, h, p]) => {
            const Icon = I as typeof ShieldCheck;
            return <div key={h as string} className="card pl"><span className="ico"><Icon /></span><h3 className="h4" style={{ marginTop: "var(--s4)" }}>{h as string}</h3><p className="body muted" style={{ marginTop: 6 }}>{p as string}</p></div>;
          })}
        </div>
      </div></section>
    </div>
  );
}
