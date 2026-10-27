/* eslint-disable @next/next/no-img-element -- Catalogue images are pre-sized and compressed. */
import { notFound } from "next/navigation";
import Link from "next/link";
import { SHOOT_STYLE_IDS, SHOOT_STYLES } from "@packshot/core";
import { INDUSTRIES, signInToShoot } from "@/lib/shoot-catalog";
const SLUGS: Record<string, string> = { beauty: "beauty", fashion: "fashion", jewellery: "jewellery", food: "food", "home-kitchen": "home_kitchen", electronics: "electronics" };
export function generateStaticParams() { return Object.keys(SLUGS).map(niche => ({ niche })); }
export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }) { const slug=(await params).niche; const i=INDUSTRIES.find(i=>i.id===SLUGS[slug]); return i ? { title: i.title + " photography" } : {}; }
export default async function UseCase({ params }: { params: Promise<{ niche: string }> }) {
  const slug=(await params).niche; const i=INDUSTRIES.find(i=>i.id===SLUGS[slug]); if(!i) notFound();
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-16">
    <div className="grid items-center gap-8 md:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">{i.title}</p><h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">A new point of view<br />for your product.</h1><p className="mt-5 text-sm leading-relaxed text-ink-2">Choose a photographic style and add your own product photo. We tailor the scene to its visible materials, form and use. Review fine details before publishing.</p><Link className="mt-6 inline-flex min-h-13 items-center rounded-full bg-accent px-7 text-sm font-semibold text-white" href={signInToShoot(i.id)}>Choose your style →</Link></div><figure><img src={i.image} alt={i.title + " AI-created industry example"} width={512} height={512} className="aspect-square w-full rounded-2xl object-cover" /><figcaption className="mt-2 text-xs text-mute">AI-created industry example</figcaption></figure></div>
    <h2 className="mb-6 mt-12 text-2xl font-semibold">Six ways to tell the story.</h2><div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">{SHOOT_STYLE_IDS.map(id=>{const s=SHOOT_STYLES[id];return <Link href={signInToShoot(i.id,id)} key={id}><img src={s.image} alt={s.title + " style example across industries"} width={512} height={512} className="aspect-square w-full rounded-xl object-cover" /><h3 className="mt-2 font-semibold">{s.title}</h3><p className="mt-1 text-xs text-mute">{s.subtitle}</p></Link>;})}</div><p className="mt-6 text-xs text-mute">Reusable AI-created style examples. Your final shot uses your own product photo.</p>
  </div>;
}
