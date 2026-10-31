import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paths = ["", "/how-it-works", "/examples", "/pricing", "/faq", "/contact", "/shopify-app", "/mobile", "/use-cases/beauty", "/use-cases/fashion", "/use-cases/jewellery", "/use-cases/food", "/use-cases/home-kitchen", "/use-cases/electronics", "/legal/terms", "/legal/privacy", "/legal/refunds", "/legal/acceptable-use"];
  return paths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.6 }));
}
