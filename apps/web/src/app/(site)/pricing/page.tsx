import { Check } from "lucide-react";
import { webPacks } from "@/lib/public";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Pricing" };
export const revalidate = 300;

export default async function Pricing() {
  const packs = await webPacks();
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
      <div className="eyebrow">Pricing</div>
      <h1 className="display mt-4 max-w-3xl text-6xl">Buy images, not a subscription.</h1>
      <p className="mt-4 max-w-2xl text-ink-2">One credit makes one delivered image at full size. Buy a pack when you need it. Bigger packs cost less per image. Prices exclude 18% GST and come with a GST invoice.</p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {packs.map((p) => {
          const featured = p.badge === "Most picked";
          return (
            <div key={p.id} className={`relative rounded-xl border p-6 ${featured ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
              {p.badge && <span className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] ${featured ? "bg-accent text-white" : "bg-accent/10 text-accent-ink"}`}>{p.badge}</span>}
              <div className={`eyebrow ${featured ? "!text-paper/60" : ""}`}>{p.name}</div>
              <div className="display mt-3 text-6xl">{p.credits}</div>
              <div className={`text-sm ${featured ? "text-paper/60" : "text-mute"}`}>images</div>
              <div className="mt-6 text-2xl font-medium">₹{(p.price_minor / 100).toLocaleString("en-IN")}</div>
              <div className={`frame-no ${featured ? "!text-paper/60" : ""}`}>₹{(p.price_minor / 100 / p.credits).toFixed(2)} per image</div>
              <LinkButton href="/sign-in?next=/app/wallet" variant={featured ? "accent" : "outline"} className="mt-6 w-full">Choose</LinkButton>
            </div>
          );
        })}
      </div>
      <div className="mt-16 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="display text-4xl">Every pack includes</h2>
          <ul className="mt-5 space-y-2.5 text-ink-2">
            {["All styles and sizes, including custom scenes", "Full-size images without watermark", "JPG, PNG and WebP downloads, ZIP for whole shoots", "One free remake per image within 7 days", "Credit back if your product changed in the image", "No charge for images that fail", "Credits valid for 12 months", "Team members share the same credits", "GST invoice for every purchase"].map((x) => (
              <li key={x} className="flex gap-2"><Check size={18} className="mt-0.5 shrink-0 text-accent" /> {x}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="display text-4xl">Good to know</h2>
          <dl className="mt-5 space-y-5 text-sm">
            <div><dt className="font-medium">Free trial</dt><dd className="mt-1 text-ink-2">2 free images when you sign up with a verified email. Trial images have a small watermark and are up to 1024px.</dd></div>
            <div><dt className="font-medium">On Shopify</dt><dd className="mt-1 text-ink-2">The Shopify app bills through your Shopify invoice in USD, as Shopify requires.</dd></div>
            <div><dt className="font-medium">On iPhone and Android</dt><dd className="mt-1 text-ink-2">In-app purchases go through Apple and Google, so app prices are a little higher. Credits bought here on the website work in the apps too.</dd></div>
            <div><dt className="font-medium">Need thousands of images?</dt><dd className="mt-1 text-ink-2">Talk to us about a custom pack and invoicing. <a className="underline" href="/contact">Contact</a></dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
