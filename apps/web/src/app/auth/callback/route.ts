import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";
import { track } from "@/lib/observe";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/app";
  if (code) {
    const supabase = await userClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user && Date.now() - new Date(data.user.created_at).getTime() < 120_000) await track("signup_completed", { userId: data.user.id }, {});
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/sign-in?error=1", url.origin));
}
