import { after } from "next/server";
import { ApiError, handler } from "@/lib/api";
import { runShoot, shootView } from "@/lib/baby/service";
import { admin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Status of one shoot. Restarts photos that got stuck (for example after a server restart). */
export const GET = handler<{ id: string }>(async (req, ctx, { id }) => {
  const [shoot] = await shootView(ctx.orgId, id);
  if (!shoot) throw new ApiError(404, "Shoot not found");
  const db = admin();
  const stale = new Date(Date.now() - 6 * 60_000).toISOString();
  const { data: stuck } = await db.from("baby_photos").update({ status: "queued" }).eq("shoot_id", id).eq("status", "running").lt("started_at", stale).select("id");
  if (stuck?.length) after(() => runShoot(id));
  return { shoot };
});
