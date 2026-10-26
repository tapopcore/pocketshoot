import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
  const { data } = await supabase.auth.getUser();
  if (!data.user && (pathname.startsWith("/app") || pathname.startsWith("/admin"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/shopify/:path*", "/sign-in"],
};
