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
  // A server run lasts at most 5 minutes. If photos are still waiting after that, start another run.
  // Photos are claimed one at a time, so two runs never make the same photo twice.
  const waiting = shoot.baby_photos.some((p) => p.status === "queued");
  const running = shoot.baby_photos.some((p) => p.status === "running");
  const old = Date.now() - new Date(shoot.created_at).getTime() > 4.5 * 60_000;
  if (stuck?.length || (waiting && !running && old)) after(() => runShoot(id));
  return { shoot };
});
