import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** baby-shoot.com serves the Baby Shoot app from this same project. Everything else stays PocketShoot. */
const BABY_HOSTS = new Set(["baby-shoot.com", "www.baby-shoot.com"]);
const BABY_ROUTES: Record<string, string> = {
  "/": "/baby/index.html",
  "/terms": "/b/terms", "/privacy": "/b/privacy", "/refunds": "/b/refunds", "/delivery": "/b/delivery", "/contact": "/b/contact", "/pricing": "/b/pricing",
  "/manifest.webmanifest": "/baby/manifest.webmanifest", "/sw.js": "/baby/sw.js", "/.well-known/assetlinks.json": "/baby/assetlinks.json",
};
const BABY_ONLY = new Set(["/terms", "/privacy", "/refunds", "/delivery", "/manifest.webmanifest", "/sw.js", "/.well-known/assetlinks.json"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (BABY_HOSTS.has(host)) {
    const to = BABY_ROUTES[pathname];
    if (to) {
      const res = NextResponse.rewrite(new URL(to + req.nextUrl.search, req.url));
      if (pathname === "/sw.js") res.headers.set("Cache-Control", "no-cache");
      return res;
    }
    // PocketShoot's own pages don't belong on baby-shoot.com.
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (BABY_ONLY.has(pathname) || pathname === "/pricing" || pathname === "/contact") return NextResponse.next();

  // If Supabase falls back to the Site URL, the sign-in link lands on "/?code=...". Finish sign-in properly.
  if (pathname === "/" && req.nextUrl.searchParams.has("code")) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (!url.searchParams.has("next")) url.searchParams.set("next", "/app");
    return NextResponse.redirect(url);
  }
  if (pathname === "/") return NextResponse.next();

  // Shopify admin embeds /shopify; allow framing only by that shop and the Shopify admin.
  if (pathname.startsWith("/shopify")) {
    const res = NextResponse.next();
    const shop = req.nextUrl.searchParams.get("shop");
    const ok = shop && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
    res.headers.set("Content-Security-Policy", `frame-ancestors ${ok ? `https://${shop} ` : ""}https://admin.shopify.com;`);
    return res;
  }

  // Keep the Supabase session fresh for signed-in areas.
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub && (pathname.startsWith("/app") || pathname.startsWith("/admin"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: [
    "/", "/app/:path*", "/admin/:path*", "/shopify/:path*", "/sign-in",
    "/terms", "/privacy", "/refunds", "/delivery", "/contact", "/pricing", "/manifest.webmanifest", "/sw.js", "/.well-known/assetlinks.json",
  ],
};
