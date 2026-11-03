/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const COLS: [string, [string, string][]][] = [
  ["Product", [["/how-it-works", "How it works"], ["/examples", "Examples"], ["/pricing", "Pricing"], ["/shopify-app", "Shopify app"], ["/mobile", "iPhone and Android"]]],
  ["Product photos for", [["/use-cases/beauty", "Skincare and beauty"], ["/use-cases/fashion", "Clothing and sarees"], ["/use-cases/jewellery", "Jewellery"], ["/use-cases/food", "Food and drinks"], ["/use-cases/home-kitchen", "Home and kitchen"]]],
  ["Company", [["/faq", "Help and questions"], ["/contact", "Contact us"], ["/legal/terms", "Terms"], ["/legal/privacy", "Privacy"], ["/legal/refunds", "Refund policy"]]],
];

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="cols">
          <div>
            <p className="h4" style={{ color: "#fff", maxWidth: 380, marginBottom: 12 }}>Studio photos from your phone</p>
            <p style={{ color: "var(--on-night-2)", fontSize: 16, maxWidth: 340 }}>AI product photography for online sellers. Turn one phone photo into studio and lifestyle product photos.</p>
            <Link href="/sign-in" className="btn btn-lime" style={{ marginTop: 24 }}>Try 2 photos free <ArrowRight /></Link>
          </div>
          {COLS.map(([h, links]) => (
            <div key={h}><h5>{h}</h5><ul>{links.map(([href, l]) => <li key={href}><Link href={href}>{l}</Link></li>)}</ul></div>
          ))}
        </div>
        <img className="flogo" src="/brand/logo-dark.svg" alt="PocketShoot" />
        <div className="base"><span>© {new Date().getFullYear()} PocketShoot. Made in India.</span><span>All prices in INR. GST extra.</span></div>
      </div>
    </footer>
  );
}
