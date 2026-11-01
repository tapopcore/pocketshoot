import type { NextConfig } from "next";

const build = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: build || "dev" },
  transpilePackages: ["@packshot/core"],
  serverExternalPackages: ["sharp", "@electric-sql/pglite"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }], minimumCacheTTL: 2592000 },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    // Demo photos rarely change: let browsers keep them for a day instead of re-checking every visit.
    const media = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/looks/:path*", headers: media },
      { source: "/showcase/:path*", headers: media },
      { source: "/style-atlas/:path*", headers: media },
      { source: "/catalog/:path*", headers: media },
      { source: "/directions/:path*", headers: media },
      { source: "/((?!shopify).*)", headers: [...security, { key: "X-Frame-Options", value: "DENY" }] },
      // The Shopify admin embeds these pages; frame-ancestors is set per shop in middleware.
      { source: "/shopify/:path*", headers: security },
    ];
  },
};

export default nextConfig;
