import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const supabase = await userClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
