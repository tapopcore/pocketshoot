import { after } from "next/server";
import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { BabyError, ensureBabyAccount, runShoot, shootView, startShoot } from "@/lib/baby/service";
import { admin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handler(async (req, ctx) => ({ shoots: await shootView(ctx.orgId) }));

/** Start a shoot. Credits are taken up front; any photo that fails gives its credit back. */
export const POST = handler(async (req, ctx) => {
  const p = await body(req, z.object({ themeIds: z.array(z.string()).min(1).max(15), shape: z.enum(["4:5", "1:1", "9:16"]), refIds: z.array(z.string().uuid()).min(1).max(5) }));
  const profile = await ensureBabyAccount(ctx);
  if (!profile.consent_at) {
    await admin().from("baby_profiles").update({ consent_at: new Date().toISOString() }).eq("organization_id", ctx.orgId);
  }
  let id: string | null;
  try { id = await startShoot(ctx, p); }
  catch (e) { if (e instanceof BabyError) throw new ApiError(e.status, e.message, e.code); throw e; }
  if (!id) throw new ApiError(402, "You need more photos for this shoot.", "needs_payment");
  after(() => runShoot(id!));
  return { id };
});
