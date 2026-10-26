import Script from "next/script";
import { Toaster } from "@/components/toaster";

export const metadata = { title: "Shopify" };

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "ui-nav-menu": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

/** Embedded inside the Shopify admin. App Bridge provides session tokens and navigation. */
export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";
  return (
    <>
      <meta name="shopify-api-key" content={apiKey} />
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="beforeInteractive" />
      <ui-nav-menu>
        <a href="/shopify" rel="home">Products</a>
        <a href="/shopify/library">Shoots</a>
        <a href="/shopify/credits">Credits</a>
      </ui-nav-menu>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
      <Toaster />
    </>
  );
}
