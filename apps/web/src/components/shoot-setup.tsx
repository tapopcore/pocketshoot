"use client";
import clsx from "clsx";
import { CATEGORIES, OUTPUT_LIST, STYLES, STYLE_LIST, t, type CategoryId, type Locale, type OutputId, type StyleId } from "@packshot/core";
import { Check, Sparkles, ShieldCheck } from "lucide-react";
import { Field, Notice, Select, Textarea } from "./ui";

export interface ShootChoices {
  mode: "preserve" | "creative";
  style: StyleId;
  output: OutputId;
  count: number;
  brandKitId: string | null;
  customBrief: string;
}

export function defaultChoices(category: CategoryId): ShootChoices {
  return { mode: "preserve", style: CATEGORIES[category].recommendedPresets[0] as StyleId, output: "square", count: 4, brandKitId: null, customBrief: "" };
}

/** Style, size, quantity and mode pickers. Shared by the web wizard, batch and the Shopify app. */
export function ShootSetup({
  value, onChange, category, locale = "en", creativeEnabled, brandKits = [], maxImages = 8, countLabel,
}: {
  value: ShootChoices;
  onChange: (v: ShootChoices) => void;
  category: CategoryId;
  locale?: Locale;
  creativeEnabled: boolean;
  brandKits?: { id: string; name: string; palette: string[] }[];
  maxImages?: number;
  countLabel?: string;
}) {
  const set = <K extends keyof ShootChoices>(k: K, v: ShootChoices[K]) => onChange({ ...value, [k]: v });
  const rec = CATEGORIES[category].recommendedPresets;
  const styles = [...STYLE_LIST].sort((a, b) => {
    const ia = rec.indexOf(a.id), ib = rec.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const forced = OUTPUT_LIST.find((o) => o.id === value.output)?.forceStyle;

  return (
    <div className="space-y-9">
      <section>
        <div className="eyebrow mb-3">Mode</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { id: "preserve", icon: ShieldCheck, title: t(locale, "wizard.mode.preserve"), hint: t(locale, "wizard.mode.preserveHint") },
            { id: "creative", icon: Sparkles, title: t(locale, "wizard.mode.creative"), hint: t(locale, "wizard.mode.creativeHint") },
          ] as const).map((m) => {
            const disabled = m.id === "creative" && !creativeEnabled;
            const active = value.mode === m.id;
            return (
              <button key={m.id} type="button" disabled={disabled} onClick={() => set("mode", m.id)} aria-pressed={active}
                className={clsx("rounded-xl border p-4 text-left transition-all", active ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink", disabled && "opacity-40")}>
                <div className="flex items-center gap-2 font-medium"><m.icon size={17} className={active ? "text-accent" : ""} /> {m.title}</div>
                <p className={clsx("mt-1.5 text-sm", active ? "text-paper/70" : "text-mute")}>{m.hint}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div className="eyebrow">Style</div>
          {forced && <span className="text-xs text-mute">Marketplace white always uses a white background</span>}
        </div>
        <div className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", forced && "pointer-events-none opacity-40")}>
          {styles.map((s) => {
            const active = value.style === s.id;
            const recommended = rec.slice(0, 3).includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => set("style", s.id)} aria-pressed={active}
                className={clsx("group relative overflow-hidden rounded-xl border text-left transition-all", active ? "border-ink ring-2 ring-ink" : "border-line hover:border-ink")}>
                <div className="relative aspect-square overflow-hidden bg-paper-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.id === "custom" ? "/looks/general-2.webp" : "/scenes/" + s.id + ".webp"} alt={s.name + " — illustrative lighting reference"} loading="lazy" decoding="async" className="size-full object-cover" />
                  {active && <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-accent text-white"><Check size={12} /></span>}
                </div>
                <div className="bg-card p-2.5">
                  <div className="flex items-center gap-1.5 text-sm font-medium">{locale === "hi" ? s.nameHi : s.name}{recommended && <span className="rounded bg-accent/10 px-1 text-[10px] text-accent-ink">Suits this</span>}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-mute">{s.description}</div>
                </div>
              </button>
            );
          })}
        </div>
        {value.style === "custom" && !forced && (
          <Field label="Describe the scene" hint="For example: on a wooden table in a café, morning light, a cup of chai beside it. Describe the setting only, not the product." className="mt-4">
            <Textarea maxLength={500} value={value.customBrief} onChange={(e) => set("customBrief", e.target.value)} />
          </Field>
        )}
      </section>

      <section>
        <div className="eyebrow mb-3">Size</div>
        <div className="flex flex-wrap gap-2">
          {OUTPUT_LIST.map((o) => {
            const active = value.output === o.id;
            const w = 26, h = Math.round((26 * o.height) / o.width);
            return (
              <button key={o.id} type="button" onClick={() => set("output", o.id)} aria-pressed={active} title={o.hint}
                className={clsx("flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm transition-colors", active ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink")}>
                <span className={clsx("inline-block rounded-[2px] border", active ? "border-paper" : "border-ink")} style={{ width: Math.min(w, 26 * (o.width / o.height)), height: Math.min(h, 26) }} />
                {o.name} <span className={clsx("frame-no", active && "!text-paper/60")}>{o.ratio}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-mute">{OUTPUT_LIST.find((o) => o.id === value.output)?.hint}</p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="eyebrow mb-3">{countLabel ?? t(locale, "wizard.count")}</div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: maxImages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => set("count", n)} aria-pressed={value.count === n}
                className={clsx("size-11 rounded-full border font-mono text-sm transition-colors", value.count === n ? "border-accent bg-accent text-white" : "border-line bg-card hover:border-ink")}>{n}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">Each image uses a different camera angle and arrangement.</p>
        </div>
        {brandKits.length > 0 && (
          <Field label="Brand kit (optional)" hint="Uses your brand colours for backgrounds and props.">
            <Select value={value.brandKitId ?? ""} onChange={(e) => set("brandKitId", e.target.value || null)}>
              <option value="">No brand kit</option>
              {brandKits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
          </Field>
        )}
      </section>

      {value.mode === "creative" && (
        <Notice tone="warn">Creative mode lets the AI redraw your product from new angles. Labels and small text can change. Check every image at 100% before using it.</Notice>
      )}
    </div>
  );
}

export function styleName(id: string) {
  return STYLES[id as StyleId]?.name ?? id;
}
