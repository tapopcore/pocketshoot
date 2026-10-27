import Link from "next/link";
import { ArrowRight, Check, Smartphone, Store, Monitor } from "lucide-react";
import { CATEGORY_LIST } from "@packshot/core";
import { DemoSlider } from "@/components/demo-slider";
import { LinkButton } from "@/components/ui";
import { webPacks } from "@/lib/public";

export const revalidate = 300;

const STEPS = [
  { n: "01", t: "Upload the photo you have", d: "Shoot your product on any plain surface with your phone. Add a second angle if you like. That's the only photo you need." },
  { n: "02", t: "Choose a visual direction", d: "See three concepts made for your product: a campaign hero, a human moment and a material story. Start with one. No prompts to write." },
  { n: "03", t: "Check, approve, download", d: "Compare every result against your photo at full size. Keep what works. If your product changed, you get the credit back." },
];

const NICHE_SLUG: Record<string, string> = { beauty: "beauty", home_kitchen: "home-kitchen", food: "food", jewellery: "jewellery" };

export default async function Home() {
  const packs = await webPacks();
  const cheapest = packs.length ? Math.min(...packs.map((p) => p.price_minor / p.credits)) / 100 : 50;
  const entry = packs[0];
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="animate-rise">
          <div className="eyebrow">AI product photography for Indian brands and makers</div>
          <h1 className="display mt-5 text-[2.9rem] leading-[0.92] sm:text-7xl lg:text-[4.9rem]">
            Your product.<br /><em className="text-accent">A point of view.</em><br />A whole new shoot.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">
            Upload a product photo. See three creative directions built around what it is, what makes it distinctive and how people use it. Choose the look; we direct the shoot and check the product details.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href="/sign-in" variant="accent" size="lg">Try 2 images free <ArrowRight size={18} /></LinkButton>
            <LinkButton href="/how-it-works" variant="ghost" size="lg">See how it works</LinkButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {["No subscription", `From ₹${Math.round(cheapest)} per image`, "GST invoice", "Credit back if your product changes"].map((x) => (
              <li key={x} className="flex items-center gap-1.5"><Check size={15} className="text-accent" /> {x}</li>
            ))}
          </ul>
        </div>
        <div className="animate-rise [animation-delay:150ms]"><DemoSlider /></div>
      </section>

      <section className="border-y border-line bg-paper-2/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
          <div className="eyebrow">Three steps</div>
          <h2 className="display mt-3 max-w-2xl text-5xl">No studio. No retoucher. No prompt writing.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t border-ink pt-5">
                <div className="frame-no">{s.n}</div>
                <h3 className="display mt-2 text-3xl">{s.t}</h3>
                <p className="mt-3 text-ink-2">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-8 lg:grid-cols-2">
        <div>
          <div className="eyebrow">Direction, with product discipline</div>
          <h2 className="display mt-3 text-5xl">A photographer&apos;s decisions. Your product&apos;s identity.</h2>
          <p className="mt-5 text-ink-2">The creative work starts before generation: understanding use, choosing a visual story, and directing composition, light, materials and a meaningful human gesture.</p>
          <p className="mt-4 text-ink-2">For still lifes, we restore product detail from your reference when possible. Human interactions use reference-guided generation so hands and the product can meet naturally. Every result needs review for fine details.</p>
          <p className="mt-4 text-sm text-mute">Every image then goes through automatic checks. They catch most problems, not all, so you always review before publishing. If your product changed, report it and the credit comes back.</p>
        </div>
        <figure className="self-center overflow-hidden rounded-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/directions/human.webp" alt="AI-created example of a natural adult skincare interaction" width={512} height={1024} className="aspect-[4/3] w-full object-cover object-[center_38%]" />
          <figcaption className="mt-3 text-xs text-mute">AI-created example · Natural skin, a purposeful gesture, believable light.</figcaption>
        </figure>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
          <div className="eyebrow !text-paper/50">Tuned for</div>
          <h2 className="display mt-3 max-w-3xl text-5xl">Four kinds of product, each with its own rules.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_LIST.filter((c) => c.id !== "other").map((c) => (
              <Link key={c.id} href={`/use-cases/${NICHE_SLUG[c.id]}`} className="group rounded-xl border border-paper/15 p-6 transition-colors hover:border-accent">
                <div className="display text-3xl">{c.label}</div>
                <p className="mt-2 text-sm text-paper/60">{c.short}</p>
                <p className="mt-4 text-sm text-paper/80">{c.preserve[0]}</p>
                <div className="mt-6 flex items-center gap-1 text-sm text-accent">See examples <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <div className="eyebrow">Three directions. One product.</div>
        <h2 className="display mt-3 text-5xl">See the idea before you choose.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            ["hero", "Campaign hero", "A distinct visual signature built from the product’s form and materials."],
            ["human", "In real life", "A believable adult interaction that shows scale, utility and a moment worth owning."],
            ["detail", "Material story", "A tactile editorial study of what makes the product different."]
          ].map(([id, title, description]) => <figure key={id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={"/directions/" + id + ".webp"} alt={description} width={512} height={1024} loading="lazy" className="aspect-[4/5] w-full rounded-2xl object-cover" />
            <figcaption className="mt-4"><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 text-sm text-mute">{description}</p></figcaption>
          </figure>)}
        </div>
        <p className="mt-5 text-xs text-mute">AI-created example photography. Your concepts are made from your own uploaded product.</p>
      </section>

      <section className="border-y border-line bg-paper-2/50">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="eyebrow">Pay for images, not months</div>
            <h2 className="display mt-3 text-5xl">One credit is one image. Buy when you need them.</h2>
            <p className="mt-5 text-ink-2">Credits only get used for images we deliver. Failed images cost nothing. Each image includes one free remake. Paid credits last 12 months.</p>
            <LinkButton href="/pricing" className="mt-8" variant="outline">See all packs</LinkButton>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {packs.slice(0, 3).map((p, i) => (
              <div key={p.id} className={`rounded-xl border p-5 ${i === 2 ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
                <div className={`eyebrow ${i === 2 ? "!text-paper/60" : ""}`}>{p.name}</div>
                <div className="display mt-2 text-5xl">{p.credits}</div>
                <div className={`text-sm ${i === 2 ? "text-paper/60" : "text-mute"}`}>images</div>
                <div className="mt-4 font-medium">₹{(p.price_minor / 100).toLocaleString("en-IN")}</div>
                <div className={`frame-no ${i === 2 ? "!text-paper/60" : ""}`}>₹{(p.price_minor / 100 / p.credits).toFixed(0)} per image + GST</div>
              </div>
            ))}
          </div>
          {entry && <p className="text-xs text-mute lg:col-span-2">Launch prices. We&apos;ll adjust them as we learn, and we&apos;ll always tell you before you pay.</p>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <div className="eyebrow">Wherever you work</div>
        <h2 className="display mt-3 max-w-3xl text-5xl">Website, Shopify admin, or the phone in your pocket.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Monitor, t: "On the web", d: "Upload, batch-shoot hundreds of SKUs with a CSV, and download ZIPs. Works on any browser.", href: "/sign-in", cta: "Start free" },
            { icon: Store, t: "Inside Shopify", d: "See every product in your store, reshoot in bulk, and push approved photos straight to the product page.", href: "/shopify-app", cta: "About the Shopify app" },
            { icon: Smartphone, t: "iPhone & Android", d: "Shoot the product on your desk and get studio images back on the same phone. Same account, same credits.", href: "/mobile", cta: "About the apps" },
          ].map((c) => (
            <Link key={c.t} href={c.href} className="group rounded-xl border border-line bg-card p-6 transition-colors hover:border-ink">
              <c.icon size={22} strokeWidth={1.6} />
              <div className="display mt-4 text-3xl">{c.t}</div>
              <p className="mt-2 text-sm text-ink-2">{c.d}</p>
              <div className="mt-5 flex items-center gap-1 text-sm">{c.cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="cropmarks rounded-[22px] bg-accent px-6 py-16 text-center text-white sm:px-16">
          <h2 className="display text-5xl sm:text-6xl">Shoot your first product free.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">Two free images when you sign up. No card needed. If you don&apos;t like what you get, you&apos;ve lost two minutes.</p>
          <LinkButton href="/sign-in" size="lg" className="mt-8 !bg-ink hover:!bg-ink-2">Start with a photo</LinkButton>
        </div>
      </section>
    </>
  );
}
