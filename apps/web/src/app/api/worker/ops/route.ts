import sharp from "sharp";
import { STYLES } from "@packshot/core";
import { json, publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { randomToken, safeEqual, sha256 } from "@/lib/crypto";
import { admin } from "@/lib/supabase";
import { getObject, publicUrl, putObject } from "@/lib/storage";
import { jsonCall, openai } from "@/lib/llm";
import { createProduct } from "@/lib/products";
import { createJob } from "@/lib/jobs";
import { getScenePreviews, saveScenePreviews } from "@/lib/scene-previews";
import type { AuthContext } from "@/lib/auth";

export const maxDuration = 300;

/**
 * Operator tasks (scene preview photos). Authorised by sha256(CRON_SECRET + ":" + op + ":" + arg),
 * so the secret never appears in a URL. Runs in the first platform admin's workspace, archived.
 */
export const GET = publicHandler(async (req) => {
  const u = new URL(req.url);
  const op = u.searchParams.get("op") ?? "";
  const arg = u.searchParams.get("arg") ?? "";
  const token = u.searchParams.get("token") ?? "";
  if (!env.cronSecret || !safeEqual(token, sha256(`${env.cronSecret}:${op}:${arg}`))) return json({ error: "unauthorized" }, 401);

  const db = admin();
  const { data: owner } = await db.from("memberships").select("organization_id, user_id, organizations(name)").eq("role", "owner").order("created_at").limit(1).single();
  if (!owner) return json({ error: "no workspace" }, 400);
  const ctx: AuthContext = { via: "web", userId: owner.user_id, email: null, orgId: owner.organization_id, orgName: "ops", role: "owner", locale: "en", platformRole: "platform_admin" };

  if (op === "sample") {
    // arg: a short description of the sample product to photograph
    const prompt = `A real photograph taken on a phone of ${arg}, standing on a plain light grey table against a plain wall, soft daylight, straight-on, whole product visible and centred, label sharp and readable. Unbranded except for the simple label described. No people, no other objects.`;
    const res = await openai().images.generate({ model: "gpt-image-2.5-sunburst", prompt, size: "1024x1536", quality: "high", n: 1 } as never) as unknown as { data: { b64_json: string }[] };
    const jpg = await sharp(Buffer.from(res.data[0].b64_json, "base64")).jpeg({ quality: 94 }).toBuffer();
    const key = `${ctx.orgId}/sample-${randomToken(6)}.jpg`;
    const { error } = await db.storage.from("uploads").upload(key, jpg, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    const p = await createProduct(ctx, { name: "Sample product", category: "beauty", locks: [], uploads: [{ key, viewType: "front" }] } as never);
    await db.from("products").update({ archived_at: new Date().toISOString() }).eq("id", p.productId);
    return { productId: p.productId };
  }

  if (op === "previews_start") {
    const ids = Object.keys(STYLES).filter((s) => s !== "custom");
    const jobs: string[] = [];
    for (let i = 0; i < ids.length; i += 8) {
      const chunk = ids.slice(i, i + 8);
      const r = await createJob(ctx, { productId: arg, mode: "preserve", style: chunk[0], styles: chunk, output: "portrait", count: chunk.length, idempotencyKey: `previews-${randomToken(8)}` }, { internal: true });
      jobs.push(r.jobId);
    }
    return { jobs };
  }

  if (op === "previews_publish") {
    const jobIds = arg.split(",").filter(Boolean);
    const { data: items } = await db.from("generation_items").select("style, delivered_asset_id, generated_assets!items_asset_fk(storage_key)").in("job_id", jobIds).not("delivered_asset_id", "is", null);
    const map = { ...(await getScenePreviews()) };
    for (const it of items ?? []) {
      const key = (it as unknown as { generated_assets: { storage_key: string } | null }).generated_assets?.storage_key;
      if (!it.style || !key) continue;
      const webp = await sharp(await getObject("outputs", key)).resize(560, 700, { fit: "cover" }).webp({ quality: 84 }).toBuffer();
      const path = `scenes/${it.style}-${Date.now().toString(36)}.webp`;
      await putObject("public", path, webp, "image/webp");
      map[it.style] = publicUrl(path);
    }
    await saveScenePreviews(map);
    return { published: Object.keys(map).length };
  }

  if (op === "critique") {
    // arg: generated asset id. An honest art-director review of one output against the product photo.
    const { data: a } = await db.from("generated_assets").select("storage_key, product_id, generation_items!generated_assets_item_id_fkey(style, params)").eq("id", arg).single();
    const { data: ref } = await db.from("product_assets").select("storage_key").eq("product_id", a!.product_id).order("created_at").limit(1).single();
    const [img, orig] = await Promise.all([getObject("outputs", a!.storage_key), getObject("originals", ref!.storage_key)]);
    const r = await jsonCall({
      models: ["gpt-5", "gpt-5-mini"], detail: "high", images: [orig, img], schemaName: "critique", timeoutMs: 120_000,
      schema: { type: "object", additionalProperties: false, required: ["overall", "realism", "product_fidelity", "integration", "composition", "describe", "issues", "fixes"],
        properties: { overall: { type: "number" }, realism: { type: "number" }, product_fidelity: { type: "number" }, integration: { type: "number" }, composition: { type: "number" },
          describe: { type: "string" }, issues: { type: "array", items: { type: "string" } }, fixes: { type: "array", items: { type: "string" } } } },
      prompt: "You are a demanding creative director at a top product photography studio. Image 1 is the customer's original product photo. Image 2 is the AI-generated campaign photo. Score 1-10 (10 = indistinguishable from a premium real shoot): overall, realism, product_fidelity (same product, label text exact), integration (does the product sit naturally in the scene with correct light, shadow, scale and perspective, or does it look pasted), composition. 'describe': describe image 2 in detail in 3-4 sentences. List concrete issues and concrete fixes to the generation approach or prompt. Be brutally honest.",
    });
    return { ...(r.data as object), item: (a as unknown as { generation_items: unknown }).generation_items };
  }

  if (op === "status") {
    const jobIds = arg.split(",").filter(Boolean);
    const { data } = await db.from("generation_items").select("status").in("job_id", jobIds);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }
  return json({ error: "unknown op" }, 400);
});
