import { handler } from "@/lib/api";
import { admin } from "@/lib/supabase";
import { getObject, removeObjects } from "@/lib/storage";
import sharp from "sharp";
import { getApiContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A small preview of one added photo, for its owner only. */
export async function GET(req: Request, route: { params: Promise<{ id: string }> }) {
  let ctx; try { ctx = await getApiContext(req); } catch { return new Response("Sign in", { status: 401 }); }
  const { id } = await route.params;
  const { data } = await admin().from("baby_refs").select("storage_key").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  const img = await sharp(await getObject("uploads", data.storage_key)).resize(360, 450, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
  return new Response(new Uint8Array(img), { headers: { "content-type": "image/webp", "cache-control": "private, max-age=3600" } });
}

export const DELETE = handler<{ id: string }>(async (req, ctx, { id }) => {
  const db = admin();
  const { data } = await db.from("baby_refs").select("storage_key").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (data) { await removeObjects("uploads", [data.storage_key]); await db.from("baby_refs").delete().eq("id", id); }
  return { ok: true };
});
