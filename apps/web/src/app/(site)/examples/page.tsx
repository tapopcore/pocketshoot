/* eslint-disable @next/next/no-img-element -- Catalogue images are pre-sized and compressed. */
import { StyleGallery } from "@/components/style-gallery";
import { LinkButton } from "@/components/ui";
import { showcase } from "@/lib/public";
export const metadata = { title: "Photographic styles" };
export const revalidate = 600;
export default async function Examples() {
  const items = await showcase();
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-16">
    <p className="text-xs font-semibold uppercase tracking-widest text-accent-ink">Find your direction</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">A style for your next story.</h1>
    <p className="mb-9 mt-4 max-w-xl text-sm leading-relaxed text-ink-2">Indoor light. Outdoor drama. A human moment. Explore six photographic approaches, then make one your own.</p>
    <StyleGallery />
    {items.length > 0 && <section className="mt-14"><h2 className="mb-6 text-2xl font-semibold">Published with permission</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{items.map(i => <figure key={i.assetId}><img src={i.url} alt={i.caption} loading="lazy" className="aspect-square w-full rounded-xl object-cover" /><figcaption className="mt-2 text-xs text-mute">{i.caption}</figcaption></figure>)}</div></section>}
    <div className="mt-12 border-t border-line pt-8"><LinkButton href="/sign-in?next=%2Fapp%2Fnew" variant="accent">Create your first shoot</LinkButton></div>
  </div>;
}
