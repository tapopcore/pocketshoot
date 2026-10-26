import { Check } from "lucide-react";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Shopify app" };

export default function ShopifyApp() {
  const listing = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="eyebrow">For Shopify stores</div>
          <h1 className="display mt-4 text-6xl">Reshoot your whole store from inside Shopify.</h1>
          <p className="mt-5 text-lg text-ink-2">Install the app and every product in your store shows up with its current photos. Pick one or a hundred, choose a look, and add the approved images straight back to each product.</p>
          {listing ? <LinkButton href={listing} variant="accent" size="lg" className="mt-8">Install from the Shopify App Store</LinkButton> : <p className="mt-8 rounded-lg bg-paper-2 px-4 py-3 text-sm">The app is in Shopify review. Use the web app in the meantime; it works with any store.</p>}
        </div>
        <ul className="space-y-4 self-center">
          {["Reads your products and existing photos, nothing else. No access to orders or customers.", "Uses your current product photo as the reference, so there's nothing to upload", "Bulk shoots: select many products, one look for all", "Approve an image and it's added to the product. Your existing photos aren't removed.", "Charges appear on your Shopify bill. No separate card.", "Same accuracy checks and credit-back promise as the web app"].map((x) => (
            <li key={x} className="flex gap-3 rounded-xl border border-line bg-card p-4"><Check size={18} className="mt-0.5 shrink-0 text-accent" /> {x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
