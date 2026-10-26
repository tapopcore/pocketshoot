import Link from "next/link";
import { Logo, LinkButton } from "@/components/ui";
import { getWebContext } from "@/lib/auth";

const NAV = [["/how-it-works", "How it works"], ["/examples", "Examples"], ["/pricing", "Pricing"], ["/faq", "FAQ"]];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getWebContext().catch(() => null);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3.5 sm:px-8">
          <Link href="/" aria-label="Home"><Logo /></Link>
          <nav className="hidden items-center gap-7 text-[15px] text-ink-2 md:flex">
            {NAV.map(([h, l]) => <Link key={h} href={h} className="hover:text-ink">{l}</Link>)}
            <Link href="/shopify-app" className="hover:text-ink">Shopify app</Link>
          </nav>
          <div className="flex items-center gap-2">
            {ctx ? <LinkButton href="/app" size="sm">Open app</LinkButton> : (
              <>
                <Link href="/sign-in" className="hidden px-3 text-sm sm:block">Sign in</Link>
                <LinkButton href="/sign-in" size="sm" variant="accent">Try 2 free images</LinkButton>
              </>
            )}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-mute">Studio and lifestyle photos of your real products, made from the photos you already have.</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="eyebrow mb-3">Product</div>
            {[["/how-it-works", "How it works"], ["/examples", "Examples"], ["/pricing", "Pricing"], ["/shopify-app", "Shopify app"], ["/mobile", "iPhone & Android"]].map(([h, l]) => <Link key={h} href={h} className="block hover:underline">{l}</Link>)}
          </div>
          <div className="space-y-2 text-sm">
            <div className="eyebrow mb-3">For</div>
            {[["/use-cases/beauty", "Beauty & skincare"], ["/use-cases/home-kitchen", "Home & kitchen"], ["/use-cases/food", "Packaged food"], ["/use-cases/jewellery", "Jewellery"]].map(([h, l]) => <Link key={h} href={h} className="block hover:underline">{l}</Link>)}
          </div>
          <div className="space-y-2 text-sm">
            <div className="eyebrow mb-3">Company</div>
            {[["/faq", "FAQ"], ["/contact", "Contact"], ["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"], ["/legal/refunds", "Credits & refunds"], ["/legal/acceptable-use", "Acceptable use"]].map(([h, l]) => <Link key={h} href={h} className="block hover:underline">{l}</Link>)}
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-xs text-mute">© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME || "PocketShoot"}. Prices exclude GST.</div>
      </footer>
    </>
  );
}
