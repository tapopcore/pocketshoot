/* eslint-disable @next/next/no-img-element -- Signed storage URLs. */
import { OUTPUT_LIST, STYLE_LIST } from "@packshot/core";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import { BRAND_MOODS } from "@/lib/brand-moods";
import { Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { deleteBrandKit, saveBrandKit } from "../actions";

export const metadata = { title: "Brand kit" };

interface Kit { id: string; name: string; palette: string[]; moods: string[] | null; style_rules: string | null; default_style: string | null; default_output: string | null; logo_key: string | null }

function KitForm({ kit, canEdit }: { kit?: Kit; canEdit: boolean }) {
  const palette = kit?.palette ?? [];
  return <ActionForm action={saveBrandKit} submit={kit ? "Save changes" : "Save brand kit"} variant="accent" resetOnSuccess={!kit} className="kitform">
    <fieldset disabled={!canEdit} className="fields">
      {kit && <input type="hidden" name="id" value={kit.id} />}
      <Field label="Kit name"><Input name="name" required defaultValue={kit?.name ?? ""} placeholder="Main brand" /></Field>
      <div><span className="label">Brand colours</span>
        <div className="cls">{Array.from({ length: 4 }, (_, i) => <label key={i} className="cl"><input type="color" name="palette" defaultValue={palette[i] ?? ["#0B0F11", "#FC4A12", "#F3EEE4", "#4F5B2E"][i]} aria-label={`Colour ${i + 1}`} /></label>)}</div>
        <p className="xs muted" style={{ marginTop: 6 }}>Used for props, backgrounds and light. Never painted onto your product.</p></div>
      <div><span className="label">Mood <span className="muted" style={{ fontWeight: 400 }}>· up to 4</span></span>
        <div className="moods">{BRAND_MOODS.map((m) => <label key={m} className="mood"><input type="checkbox" name="moods" value={m} defaultChecked={kit?.moods?.includes(m)} /><span className="pill">{m}</span></label>)}</div></div>
      <Field label="Always and never" hint="For example: always show green leaves; never use plastic props or neon colours."><Textarea name="styleRules" maxLength={600} defaultValue={kit?.style_rules ?? ""} /></Field>
      <div className="g2">
        <Field label="Usual style"><Select name="defaultStyle" defaultValue={kit?.default_style ?? ""}><option value="">No preference</option>{STYLE_LIST.filter((s) => s.id !== "custom").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Usual size"><Select name="defaultOutput" defaultValue={kit?.default_output ?? ""}><option value="">No preference</option>{OUTPUT_LIST.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
      </div>
      <Field label="Logo" hint="PNG or SVG with a clear background. Kept for reference only."><Input type="file" name="logo" accept="image/png,image/jpeg,image/webp" style={{ paddingTop: 12 }} /></Field>
    </fieldset>
  </ActionForm>;
}

export default async function Brand() {
  const ctx = await requireWeb();
  const { data } = await admin().from("brand_kits").select("*").eq("organization_id", ctx.orgId).order("created_at");
  const kits = (data ?? []) as Kit[];
  const logos = await signedUrls("brand", kits.map((k) => k.logo_key).filter((k): k is string => !!k), 3600);
  const canEdit = ctx.role !== "viewer";
  return (
    <div className="pg-brand">
      <PageHeader title="Brand kit">Set it once and every shoot follows your colours, mood and rules.</PageHeader>
      <div className="bk">
        <div style={{ display: "grid", gap: "var(--s4)" }}>
          {kits.map((k) => <section key={k.id} className="card pl">
            <div className="between">
              <div className="row" style={{ gap: "var(--s3)", minWidth: 0 }}>
                {k.logo_key && logos[k.logo_key] ? <img src={logos[k.logo_key]} alt="" className="klogo" /> : <span className="ico dark">{k.name.slice(0, 1).toUpperCase()}</span>}
                <div style={{ minWidth: 0 }}><h2 className="h4">{k.name}</h2><p className="xs muted">{(k.moods ?? []).join(" · ") || "No mood set"}</p></div>
              </div>
              {canEdit && <form action={deleteBrandKit}><input type="hidden" name="id" value={k.id} /><button className="link sm" style={{ color: "var(--muted)" }}>Delete</button></form>}
            </div>
            <div className="swatches">{k.palette.map((c) => <i key={c} style={{ background: c }} title={c} />)}</div>
            <details className="edit"><summary>Edit this kit</summary><KitForm kit={k} canEdit={canEdit} /></details>
          </section>)}
          <section className="card pl">
            <h2 className="h4">{kits.length ? "Add another kit" : "Your brand kit"}</h2>
            <p className="sm muted" style={{ marginTop: 4 }}>{kits.length ? "Useful if you sell under more than one brand." : "Takes a minute. Every new shoot uses it automatically."}</p>
            <KitForm canEdit={canEdit} />
          </section>
        </div>
        <aside className="card pl prv">
          <span className="sm muted">How it works</span>
          <h2 className="h5" style={{ marginTop: 4 }}>Your look on every photo</h2>
          <div className="gx" style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--s2)", marginTop: "var(--s4)" }}>{["skincare-4", "skincare-1", "skincare-3", "fragrance-5"].map((k) => <div key={k} className="ph r11" style={{ borderRadius: 12 }}><img src={`/showcase/${k}.webp`} alt="" loading="lazy" decoding="async" /></div>)}</div>
          <ul className="how">{["Colours guide props, backgrounds and light", "Mood sets the feel of each scene", "Always and never notes are followed in every shoot", "Your product and label never change"].map((t) => <li key={t}>{t}</li>)}</ul>
        </aside>
      </div>
    </div>
  );
}
