import { after } from "next/server";
import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { admin } from "@/lib/supabase";
import { getObject, removeObjects } from "@/lib/storage";
import { makePhoto } from "@/lib/baby/service";
import sharp from "sharp";
import type { BabyShape } from "@/lib/baby/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Act = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remake") }),
  z.object({ action: z.literal("keep"), take: z.enum(["first", "new"]) }),
  z.object({ action: z.literal("feedback"), value: z.enum(["yes", "no"]) }),
]);

export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  const a = await body(req, Act);
  const db = admin();
  const { data: photo } = await db.from("baby_photos").select("*, baby_shoots(shape, ref_ids)").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!photo) throw new ApiError(404, "Photo not found");
  if (a.action === "feedback") { await db.from("baby_photos").update({ feedback: a.value }).eq("id", id); return { ok: true }; }
  if (a.action === "keep") { await db.from("baby_photos").update({ kept: a.take }).eq("id", id); return { ok: true }; }
  if (photo.remade) throw new ApiError(409, "This photo has had its free remake.", "remake_used");
  if (photo.status !== "done") throw new ApiError(409, "This photo isn't ready yet.");
  const shoot = photo.baby_shoots as { shape: BabyShape; ref_ids: string[] };
  const { data: refs } = await db.from("baby_refs").select("storage_key").eq("organization_id", ctx.orgId).in("id", shoot.ref_ids);
  if (!refs?.length) throw new ApiError(409, "Add your baby's photos again to remake this one.", "no_photos");
  const bufs = await Promise.all(refs.map(async (r) => sharp(await getObject("uploads", r.storage_key)).resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer()));
  const { data: prof } = await db.from("baby_profiles").select("sex").eq("organization_id", ctx.orgId).maybeSingle();
  after(() => makePhoto(id, bufs, shoot.shape, { remake: true, sex: (prof?.sex ?? null) as "boy" | "girl" | null }));
  return { ok: true };
});

export const DELETE = handler<{ id: string }>(async (req, ctx, { id }) => {
  const db = admin();
  const { data: photo } = await db.from("baby_photos").select("storage_key, first_key").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!photo) throw new ApiError(404, "Photo not found");
  const keys = [photo.storage_key, photo.first_key].filter((k): k is string => !!k);
  if (keys.length) await removeObjects("outputs", keys);
  await db.from("baby_photos").update({ status: "deleted", storage_key: null, first_key: null }).eq("id", id);
  return { ok: true };
});
