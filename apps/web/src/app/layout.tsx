import type { Metadata, Viewport } from "next";
// Self-hosted fonts (bundled from npm, no request to Google at runtime).
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource-variable/schibsted-grotesk/index.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./globals.css";

const name = process.env.NEXT_PUBLIC_APP_NAME || "PocketShoot";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: `${name}: studio product photos from your phone photos`, template: `%s | ${name}` },
  description: "Upload a plain photo of your product and get studio and lifestyle shots guided by your product references and category-specific creative direction. Pay per image, no subscription.",
  openGraph: { siteName: name, type: "website" },
};

export const viewport: Viewport = { themeColor: "#f6f6f4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
