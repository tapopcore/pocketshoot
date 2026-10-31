import type { Metadata, Viewport } from "next";
// Self-hosted fonts (bundled from npm, no request to Google at runtime).
import "@fontsource-variable/albert-sans/index.css";
import "@fontsource/bodoni-moda/latin-500-italic.css";
import "./globals.css";

const name = process.env.NEXT_PUBLIC_APP_NAME || "PocketShoot";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: `AI Product Photography for Online Sellers in India | ${name}`, template: `%s | ${name}` },
  description: "Turn a phone photo into professional product photos for Amazon, Flipkart, Shopify and Instagram. Studio and lifestyle shots in minutes. 2 photos free.",
  openGraph: { siteName: name, type: "website" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="ps min-h-dvh antialiased">
        {/* Focus rings only after real keyboard use (Tab). Taps, and the volume/power keys used for screenshots, never show them. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var d=document.documentElement;addEventListener("keydown",function(e){if(e.key==="Tab")d.setAttribute("data-kbd","")},true);addEventListener("pointerdown",function(){d.removeAttribute("data-kbd")},true)})();` }} />
        {children}
      </body>
    </html>
  );
}
