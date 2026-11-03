import { requirePlatform } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Badge, Card, Field, Input, PageHeader, Select, formatDate, money } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveCouponAction, savePackAction, toggleCouponAction, togglePackAction } from "../actions";

export default async function Pricing() {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const db = admin();
  const [{ data: packs }, { data: coupons }] = await Promise.all([
    db.from("pricing_packs").select("*").order("channel").order("sort").order("version", { ascending: false }),
    db.from("coupons").select("*").order("created_at", { ascending: false }),
  ]);
  const channels = ["web", "shopify", "ios", "android"];
  return (
    <div>
      <PageHeader eyebrow="No deploy needed" title="Pricing & coupons">Saving a pack with an existing code and channel creates a new version and retires the old one. Past orders keep their snapshot. Trial credits and expiry live in Settings.</PageHeader>
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {channels.map((ch) => (
            <Card key={ch} className="overflow-x-auto p-4">
              <h2 className="display mb-2 text-2xl capitalize">{ch === "web" ? "Website (Razorpay)" : ch === "shopify" ? "Shopify billing" : ch === "ios" ? "iOS in-app" : "Android in-app"}</h2>
              {(ch === "ios" || ch === "android") && <p className="mb-2 text-xs text-mute">Set store prices in App Store Connect / Play Console and RevenueCat. Rows here map store product IDs to credits.</p>}
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-mute"><th className="py-1">Code</th><th>Name</th><th>v</th><th>Credits</th><th>Price</th><th>Per image</th><th>Store ID</th><th></th></tr></thead>
                <tbody>{(packs ?? []).filter((p) => p.channel === ch).map((p) => (
                  <tr key={p.id} className={`border-t border-line ${p.active ? "" : "text-mute"}`}>
                    <td className="py-1.5 font-mono text-xs">{p.code}</td><td>{p.name} {p.badge && <Badge tone="accent">{p.badge}</Badge>}</td><td>{p.version}</td><td>{p.credits}</td>
                    <td>{money(p.price_minor, p.currency)}</td><td>{money(Math.round(p.price_minor / p.credits), p.currency)}</td><td className="font-mono text-xs">{p.store_product_id}</td>
                    <td><form action={togglePackAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><button className="text-xs underline">{p.active ? "Retire" : "Activate"}</button></form></td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          ))}
          <Card className="overflow-x-auto p-4">
            <h2 className="display mb-2 text-2xl">Coupons</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-mute"><th className="py-1">Code</th><th>Off</th><th>Bonus</th><th>Used</th><th>Valid until</th><th>Packs</th><th></th></tr></thead>
              <tbody>{(coupons ?? []).map((c) => (
                <tr key={c.id} className={`border-t border-line ${c.active ? "" : "text-mute"}`}>
                  <td className="py-1.5 font-mono">{c.code}</td><td>{c.percent_off}%</td><td>{c.bonus_credits}</td><td>{c.redeemed_count}{c.max_redemptions ? `/${c.max_redemptions}` : ""}</td>
                  <td>{c.valid_until ? formatDate(c.valid_until) : "-"}</td><td className="text-xs">{(c.pack_codes ?? []).join(", ") || "all"}</td>
                  <td><form action={toggleCouponAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.active ? "0" : "1"} /><button className="text-xs underline">{c.active ? "Disable" : "Enable"}</button></form></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="display text-2xl">Save a pack</h2>
            <ActionForm action={savePackAction} submit="Save pack" className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Code"><Input name="code" required placeholder="starter" /></Field>
              <Field label="Channel"><Select name="channel">{channels.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Name" className="col-span-2"><Input name="name" required /></Field>
              <Field label="Credits"><Input name="credits" type="number" required /></Field>
              <Field label="Price (before tax)"><Input name="price" type="number" step="0.01" required /></Field>
              <Field label="Currency"><Select name="currency"><option>INR</option><option>USD</option></Select></Field>
              <Field label="Sort"><Input name="sort" type="number" defaultValue={0} /></Field>
              <Field label="Badge"><Input name="badge" placeholder="Most picked" /></Field>
              <Field label="Store product ID"><Input name="storeProductId" placeholder="iOS/Android only" /></Field>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <h2 className="display text-2xl">Save a coupon</h2>
            <ActionForm action={saveCouponAction} submit="Save coupon" className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Code" className="col-span-2"><Input name="code" required placeholder="DIWALI20" /></Field>
              <Field label="% off"><Input name="percentOff" type="number" min={0} max={100} defaultValue={0} /></Field>
              <Field label="Bonus credits"><Input name="bonusCredits" type="number" min={0} defaultValue={0} /></Field>
              <Field label="Max uses"><Input name="maxRedemptions" type="number" min={1} /></Field>
              <Field label="Per workspace"><Input name="perOrgLimit" type="number" min={1} defaultValue={1} /></Field>
              <Field label="Valid until"><Input name="validUntil" type="date" /></Field>
              <Field label="Pack codes"><Input name="packCodes" placeholder="brand, business" /></Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
