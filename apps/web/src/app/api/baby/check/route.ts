import { NextResponse } from "next/server";
import { labCodeOk, labEnabled } from "@/lib/baby/gate";
import { integrations } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!labEnabled()) return new NextResponse(null, { status: 404 });
  if (!labCodeOk(req.headers.get("x-baby-code"))) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, live: integrations.openai });
}
