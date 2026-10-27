import { notFound } from "next/navigation";
import { CATEGORIES, LOCKS, STYLES, type CategoryId, type StyleId } from "@packshot/core";
import { LinkButton } from "@/components/ui";

const PAGES: Record<string, { id: CategoryId; headline: string; intro: string; who: string[]; uses: string[] }> = {
  beauty: {
    id: "beauty",
    headline: "Skincare and beauty photos that keep every word on the label.",
    intro: "Ingredient lists, claims and batch details are where generic AI tools go wrong. We keep your packaging pixels from your photo and build the set around them: marble, water, botanicals, or a clean white sweep.",
    who: ["D2C skincare and haircare brands", "Private-label manufacturers", "Salons and studios selling retail products", "Marketplace sellers on Nykaa, Amazon and Flipkart"],
    uses: ["New launch hero shots without a studio day", "Consistent product page images across a range", "Festive and seasonal campaign visuals", "Quick Instagram and Meta ad creatives in 4:5 and 9:16"],
  },
  "home-kitchen": {
    id: "home_kitchen",
    headline: "Cups, cookware and decor in real-looking homes.",
    intro: "Put a steel bottle on a sunlit counter or a planter in a styled living room without renting either. Handles, lids, prints and finishes stay as they are in your photo.",
    who: ["Kitchenware and homeware manufacturers", "Exporters building catalogues", "Gifting brands", "Small sellers with dozens of SKUs"],
    uses: ["Catalogue and brochure images on white", "Lifestyle shots for product pages", "Festive gifting visuals", "Wholesale catalogues for WhatsApp selling"],
  },
  food: {
    id: "food",
    headline: "Packaged food photos that don't touch your FSSAI details.",
    intro: "Nutrition tables, veg marks, MRP and weight are legal details. We never redraw them. We place your real pack in a kitchen, a festive spread or on marketplace white.",
    who: ["Spice, snack and sweets brands", "Tea, coffee and beverage makers", "Regional FMCG manufacturers", "Quick-commerce and marketplace sellers"],
    uses: ["Marketplace listing images", "Festive and gifting campaigns", "Distributor and retailer catalogues", "Social posts for new flavours"],
  },
  jewellery: {
    id: "jewellery",
    headline: "Jewellery and accessories, shot with care.",
    intro: "Shiny metal and stones are the hardest thing for AI to get right, and we say so up front. We keep stone count, settings and metal colour from your photo, mark images that need a closer look, and return the credit if the piece changed.",
    who: ["Fine and fashion jewellery brands", "Watch and accessory sellers", "Bag and leather goods makers", "Instagram-first boutiques"],
    uses: ["Dark luxury hero shots", "Clean white product page images", "Festive and wedding season visuals", "Consistent catalogue across many pieces"],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((niche) => ({ niche }));
}

export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }) {
  const p = PAGES[(await params).niche];
  return p ? { title: CATEGORIES[p.id].label, description: p.intro } : {};
}

export default async function UseCase({ params }: { params: Promise<{ niche: string }> }) {
  const page = PAGES[(await params).niche];
  if (!page) notFound();
  const cat = CATEGORIES[page.id];
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
      <div className="eyebrow">{cat.label}</div>
      <h1 className="display mt-4 max-w-4xl text-6xl">{page.headline}</h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-2">{page.intro}</p>
      <LinkButton href="/sign-in" variant="accent" size="lg" className="mt-8">Try 2 images free</LinkButton>
      {cat.difficulty === "harder" && <p className="mt-6 max-w-2xl rounded-xl border border-warn/30 bg-warn/5 p-4 text-sm">{cat.caution}</p>}

      <div className="mt-16 grid gap-10 md:grid-cols-3">
        <section className="border-t border-ink pt-4">
          <h2 className="display text-3xl">What we protect</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">
            {cat.defaultLocks.map((l) => <li key={l}>✓ {LOCKS[l].label}</li>)}
            {cat.preserve.map((r) => <li key={r}>✓ {r}</li>)}
          </ul>
        </section>
        <section className="border-t border-ink pt-4">
          <h2 className="display text-3xl">Who uses it</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">{page.who.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
        <section className="border-t border-ink pt-4">
          <h2 className="display text-3xl">What for</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">{page.uses.map((u) => <li key={u}>{u}</li>)}</ul>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="display text-4xl">A direction made for your product</h2>
        <p className="mt-3 max-w-xl text-ink-2">Your product gets its own concepts after upload. These AI-created skincare examples show the three photographic approaches.</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {["hero", "human", "detail"].map((id, i) => <figure key={id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={"/directions/" + id + ".webp"} alt={["Campaign hero example", "Human interaction example", "Material detail example"][i]} width={512} height={1024} loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover" />
            <figcaption className="mt-2 text-sm">{["Campaign hero", "In real life", "Material story"][i]}</figcaption>
          </figure>)}
        </div>
      </section>
    </div>
  );
}
