import { CATEGORIES, isCategoryId } from "@packshot/core";
import { showcase } from "@/lib/public";
import { DemoSlider } from "@/components/demo-slider";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Examples" };
export const revalidate = 600;

export default async function Examples() {
  const items = await showcase();
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
      <div className="eyebrow">Examples</div>
      <h1 className="display mt-4 max-w-3xl text-6xl">Real products, real results.</h1>
      <p className="mt-4 max-w-2xl text-ink-2">We only show images made for real customers who agreed to share them, without retouching. Until we have enough of those, here&apos;s an illustration of how it works.</p>
      {items.length > 0 ? (
        <div className="mt-12 columns-2 gap-4 sm:columns-3 lg:columns-4">
          {items.map((i) => (
            <figure key={i.assetId} className="mb-4 break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt={i.caption} loading="lazy" className="w-full rounded-lg" />
              <figcaption className="mt-1.5 text-xs text-mute">{i.caption}{isCategoryId(i.category) ? ` · ${CATEGORIES[i.category].label}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-12 max-w-2xl"><DemoSlider /></div>
      )}
      <div className="mt-16 rounded-xl border border-line p-8 text-center">
        <h2 className="display text-4xl">The best example is your own product.</h2>
        <p className="mt-2 text-ink-2">Two free images, no card needed.</p>
        <LinkButton href="/sign-in" variant="accent" className="mt-6">Try it now</LinkButton>
      </div>
    </div>
  );
}
