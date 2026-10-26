import { z } from "zod";
import sharp from "sharp";
import { STYLES } from "@packshot/core";
import { ApiError, body, handler } from "@/lib/api";
import { createJob } from "@/lib/jobs";
import { admin } from "@/lib/supabase";
import { getObject, putObject, publicUrl } from "@/lib/storage";
import { getScenePreviews, saveScenePreviews } from "@/lib/scene-previews";
import { randomToken } from "@/lib/crypto";

export const maxDuration = 120;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), productId: z.string().uuid(), scenes: z.array(z.string()).optional() }),
  z.object({ action: z.literal("publish"), jobIds: z.array(z.string().uuid()).min(1).max(10) }),
]);

/**
 * Makes real example photos for the scene picker.
 * "start" shoots one product in every scene (no credits used); "publish" copies the results to public storage.
 */
export const POST = handler(async (req, ctx) => {
  if (ctx.platformRole !== "platform_admin") throw new ApiError(403, "Platform admins only");
  const input = await body(req, schema);
  if (input.action === "start") {
    const ids = (input.scenes?.length ? input.scenes : Object.keys(STYLES)).filter((s) => s in STYLES && s !== "custom");
    const jobs: string[] = [];
    for (let i = 0; i < ids.length; i += 8) {
      const chunk = ids.slice(i, i + 8);
      const r = await createJob(ctx, { productId: input.productId, mode: "preserve", style: chunk[0], styles: chunk, output: "portrait", count: chunk.length, idempotencyKey: `previews-${randomToken(8)}` }, { internal: true });
      jobs.push(r.jobId);
    }
    return { jobs };
  }
  const db = admin();
  const { data: items } = await db.from("generation_items").select("style, delivered_asset_id, generated_assets!items_asset_fk(storage_key)").in("job_id", input.jobIds).not("delivered_asset_id", "is", null);
  const map = { ...(await getScenePreviews()) };
  for (const it of items ?? []) {
    const key = (it as unknown as { generated_assets: { storage_key: string } | null }).generated_assets?.storage_key;
    if (!it.style || !key) continue;
    const webp = await sharp(await getObject("outputs", key)).resize(480, 600, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    const path = `scenes/${it.style}-${Date.now().toString(36)}.webp`;
    await putObject("public", path, webp, "image/webp");
    map[it.style] = publicUrl(path);
  }
  await saveScenePreviews(map);
  return { published: Object.keys(map).length };
});
