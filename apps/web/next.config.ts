import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@packshot/core"],
  serverExternalPackages: ["sharp", "@electric-sql/pglite"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/((?!shopify).*)", headers: [...security, { key: "X-Frame-Options", value: "DENY" }] },
      // The Shopify admin embeds these pages; frame-ancestors is set per shop in middleware.
      { source: "/shopify/:path*", headers: security },
    ];
  },
};

export default nextConfig;
