/* eslint-disable @next/next/no-img-element -- Catalogue images are pre-sized and compressed. */
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { StyleGallery } from "@/components/style-gallery";
import { INDUSTRIES, signInToShoot } from "@/lib/shoot-catalog";
import { webPacks } from "@/lib/public";
export const revalidate = 300;
export default async function Home() {
  const packs = await webPacks();
  return <>
    <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-9 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-20">
      <div>
        <div className="mb-5 flex items-center gap-2 text-xs font-medium text-ink-2"><span className="size-1.5 rounded-full bg-accent" /> The creative studio in your pocket</div>
        <h1 className="text-[45px] font-semibold leading-[0.99] tracking-[-0.055em] sm:text-[68px] lg:text-[76px]">Your product.<br />Worth a<br /><span className="serif-i text-accent-ink">second look.</span></h1>
        <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ink-2 sm:text-lg">Turn a simple product photo into a considered campaign. Real-world settings, human moments and details worth getting closer to.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href={signInToShoot()} className="inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-accent px-7 text-sm font-semibold text-white hover:bg-accent-ink">Create your first shoot <ArrowRight size={18} /></Link><a href="#styles" className="inline-flex min-h-13 items-center justify-center gap-2 px-5 text-sm font-medium">Explore the styles <ArrowUpRight size={16} /></a></div>
        <p className="mt-4 text-xs text-mute">No prompt writing. No subscription. Credit cost shown before you create.</p>
      </div>
      <div className="relative">
        <div className="grid grid-cols-[1.15fr_0.85fr] gap-2.5 sm:gap-4">
          <figure className="row-span-2 overflow-hidden rounded-2xl bg-paper-2"><img src="/catalog/model.webp" alt="AI-created editorial example: an adult model holding a cosmetic bottle in natural light" width={512} height={512} fetchPriority="high" className="h-full min-h-[310px] w-full object-cover object-[58%_center] sm:min-h-[470px]" /></figure>
          <figure className="overflow-hidden rounded-2xl bg-paper-2"><img src="/catalog/graphic.webp" alt="AI-created graphic campaign example with a coral sneaker" width={512} height={512} className="aspect-square size-full object-cover" /></figure>
          <figure className="overflow-hidden rounded-2xl bg-paper-2"><img src="/catalog/outdoor.webp" alt="AI-created outdoor bottle photography example" width={512} height={512} className="aspect-square size-full object-cover" /></figure>
        </div>
        <p className="mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-mute"><span>Art direction, in every frame</span><span>AI-created examples</span></p>
      </div>
    </section>
    <section id="styles" className="scroll-mt-24 border-y border-line bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-20">
        <div className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Made for what you sell</p><h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">The right direction.<br /><span className="serif-i font-normal">For your kind of product.</span></h2></div>
        <StyleGallery />
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20">
      <div className="mb-9"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">A little input. A clear direction.</p><h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">You bring the product.<br />We direct the scene.</h2></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">{[
        ["01", "Your photo", "Take or choose a clear photo. Keep it visible as we understand it."],
        ["02", "Your product", "Confirm its type, visible details and useful references."],
        ["03", "Your direction", "Choose from photographic looks compatible with your product."],
        ["04", "Your shoot", "Check the credit cost, create, review and download."],
      ].map(([n,t,d]) => <div key={n} className="border-t border-ink/20 pt-4"><span className="font-mono text-xs text-accent-ink">{n}</span><h3 className="mt-3 text-lg font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p></div>)}</div>
    </section>
    <section className="bg-[#20251f] text-[#f6f4ec]">
      <div className="mx-auto grid max-w-7xl gap-9 px-4 py-12 sm:px-8 sm:py-20 md:grid-cols-2 md:gap-16">
        <img src="/catalog/closeup.webp" alt="AI-created close-up example showing leather grain and stitching" width={512} height={512} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" />
        <div className="self-center"><p className="text-xs uppercase tracking-[0.14em] text-[#c5ccbf]">The details make the difference</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">Less AI gloss.<br /><span className="serif-i font-normal">More photographic intent.</span></h2><p className="mt-5 max-w-md text-sm leading-relaxed text-[#d9ded4]">Light with a source. Materials with texture. Human poses that make sense. Each style has a specific direction, while your reference guides the product&apos;s identity.</p><p className="mt-4 max-w-md text-sm leading-relaxed text-[#c5ccbf]">Automatic checks flag product changes and visual issues. You review the result before it goes anywhere.</p><Link href="/how-it-works" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4">See how we make a shoot <ArrowRight size={16} /></Link></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20">
      <div className="mb-7 flex items-end justify-between"><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Made for what you make.</h2></div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-5">{INDUSTRIES.map(i => <Link href={signInToShoot(i.id)} key={i.id} className="group"><img src={i.image} alt={i.title + " industry example"} width={512} height={512} loading="lazy" className="aspect-square w-full rounded-xl object-cover" /><span className="mt-2 block text-xs font-semibold leading-relaxed sm:text-sm">{i.title}</span></Link>)}</div>
    </section>
    <section className="border-y border-line bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.85fr_1.15fr]">
        <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">Pay when you create</p><h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your next campaign.<br />At your own pace.</h2><p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-2">Browse every style before spending credits. The total is visible before you create a shoot.</p><Link href="/pricing" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4">View packs and terms <ArrowRight size={15} /></Link></div>
        <div className="grid gap-3 sm:grid-cols-3">{packs.slice(0,3).map(p => <Link key={p.id} href="/pricing" className="rounded-2xl border border-line p-5"><div className="text-xs text-mute">{p.name}</div><div className="mt-4 text-3xl font-semibold tracking-tight">₹{(p.price_minor/100).toLocaleString("en-IN")}</div><div className="mt-2 text-sm text-ink-2">{p.credits} credits</div><div className="mt-4 text-xs text-mute">+ GST · no subscription</div></Link>)}</div>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-8 sm:py-20 md:grid-cols-[0.8fr_1.2fr]">
      <h2 className="text-3xl font-semibold tracking-tight">A few good questions.</h2>
      <div>{[
        ["Do I need to write prompts?", "No. Start with a product photo and choose a compatible visual direction. A creative note is optional."],
        ["Are the style images my final result?", "They are reusable AI-created examples that explain each look. Your own image is generated from your product photo after you press Create."],
        ["Can the product details change?", "AI can change fine details. We run automatic checks, and you should review labels, logos, jewellery settings and human interactions before publishing."],
        ["When do I spend credits?", "You see the total before pressing Create. Credits are reserved for the shoot and captured for delivered images. See the pricing and refunds pages for the full policy."],
      ].map(([q,a]) => <details key={q} className="border-t border-line py-1"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 text-sm font-semibold">{q}<span className="text-lg font-normal text-mute">+</span></summary><p className="pb-5 text-sm leading-relaxed text-ink-2">{a}</p></details>)}</div>
    </section>
    <section className="mx-auto max-w-7xl px-4 sm:px-8"><div className="rounded-3xl bg-[#e9e5da] px-6 py-12 text-center sm:py-16"><h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Give your product<br /><span className="serif-i font-normal">its next great photograph.</span></h2><Link href={signInToShoot()} className="mt-6 inline-flex min-h-13 items-center gap-3 rounded-full bg-ink px-7 text-sm font-semibold text-paper">Find your style <ArrowRight size={17} /></Link></div></section>
  </>;
}
