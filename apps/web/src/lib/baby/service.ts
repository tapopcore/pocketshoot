import "server-only";
import sharp from "sharp";
import { toFile } from "openai";
import { admin } from "@/lib/supabase";
import { env } from "@/lib/env";
import { openai } from "@/lib/llm";
import { classifyHttpError } from "@/lib/providers";
import { getObject, putObject, removeObjects } from "@/lib/storage";
import { normalizeEmail } from "@/lib/credits";
import type { AuthContext } from "@/lib/auth";
import { BABY_SIZES, babyPrompt, babyTheme, type BabyShape, type BabyState } from "./themes";

const MODEL = "gpt-image-2.5-sunburst";
export const BABY_PACKS = [1, 6, 10, 15] as const;

export interface BabyProfile { baby_name: string | null; age_band: string | null; prefs: Record<string, unknown>; consent_at: string | null; free_photo_granted: boolean }

/** First visit on Baby Shoot: make the profile and give one free photo, once per person. */
export async function ensureBabyAccount(ctx: AuthContext, phone?: string | null): Promise<BabyProfile> {
  const db = admin();
  const { data: existing } = await db.from("baby_profiles").select("*").eq("organization_id", ctx.orgId).maybeSingle();
  if (existing) return existing as BabyProfile;
  await db.from("baby_profiles").insert({ organization_id: ctx.orgId, user_id: ctx.userId }).select().maybeSingle();
  const identity = ctx.email ? `email:${normalizeEmail(ctx.email)}` : phone ? `phone:${phone.replace(/\D/g, "").slice(-10)}` : `user:${ctx.userId}`;
  const { error } = await db.from("baby_free_grants").insert({ identity_key: identity, organization_id: ctx.orgId });
  if (!error) {
    await db.rpc("grant_credits", {
      p_org: ctx.orgId, p_kind: "trial", p_entry_type: "trial", p_quantity: 1, p_expires_at: null,
      p_source_type: "baby_free_photo", p_source_ref: ctx.userId, p_idempotency_key: `babyfree:${identity}`,
    });
    await db.from("baby_profiles").update({ free_photo_granted: true }).eq("organization_id", ctx.orgId);
  }
  const { data } = await db.from("baby_profiles").select("*").eq("organization_id", ctx.orgId).single();
  return data as BabyProfile;
}

export async function babyBalance(orgId: string): Promise<number> {
  const { data } = await admin().rpc("baby_balance", { p_org: orgId });
  return (data as number | null) ?? 0;
}

export async function babyPacks() {
  const { data } = await admin().from("pricing_packs").select("id,code,name,credits,price_minor,badge").eq("channel", "baby").eq("active", true).order("sort");
  return data ?? [];
}

/** Store one photo of the baby that the parent added. Rejects screenshots and tiny files. */
export async function saveRef(orgId: string, file: File) {
  if (file.size > 15 * 1024 * 1024) throw new BabyError(413, "too_large", "That photo is too large. Try another one.");
  let buf: Buffer, w = 0, h = 0;
  try {
    const src = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "none" }).rotate();
    const m = await src.metadata();
    w = m.autoOrient?.width ?? m.width ?? 0; h = m.autoOrient?.height ?? m.height ?? 0;
    buf = await src.resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  } catch { throw new BabyError(400, "bad_image", "That file doesn't look like a photo we can read."); }
  if (Math.max(w, h) < 1000) throw new BabyError(422, "too_small", "Too small. Add the original photo, not a screenshot.");
  const db = admin();
  const { data, error } = await db.from("baby_refs").insert({ organization_id: orgId, storage_key: "pending", width: w, height: h }).select("id").single();
  if (error) throw error;
  const key = `baby-refs/${orgId}/${data.id}.jpg`;
  await putObject("uploads", key, buf, "image/jpeg");
  await db.from("baby_refs").update({ storage_key: key }).eq("id", data.id);
  return { id: data.id as string };
}

export class BabyError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Create a shoot, spend its credits and queue every photo. Returns null when the wallet is short. */
export async function startShoot(ctx: AuthContext, input: { themeIds: string[]; shape: BabyShape; refIds: string[] }) {
  const themes = input.themeIds.map(babyTheme);
  if (!themes.length || themes.length > 15 || themes.some((t) => !t)) throw new BabyError(400, "bad_request", "Pick between 1 and 15 sets.");
  if (!BABY_SIZES[input.shape]) throw new BabyError(400, "bad_request", "Unknown photo shape.");
  const db = admin();
  const { data: refs } = await db.from("baby_refs").select("id").eq("organization_id", ctx.orgId).in("id", input.refIds.slice(0, 5));
  if (!refs?.length) throw new BabyError(400, "no_photos", "Add at least one photo of your baby.");
  const { data: shoot, error } = await db.from("baby_shoots").insert({ organization_id: ctx.orgId, user_id: ctx.userId, shape: input.shape, ref_ids: refs.map((r) => r.id), credits_spent: themes.length }).select("id").single();
  if (error) throw error;
  const { data: ok } = await db.rpc("baby_spend", { p_org: ctx.orgId, p_shoot: shoot.id, p_quantity: themes.length });
  if (!ok) { await db.from("baby_shoots").delete().eq("id", shoot.id); return null; }
  const n = themes.length;
  await db.from("baby_photos").insert(themes.map((t, i) => ({ shoot_id: shoot.id, organization_id: ctx.orgId, idx: i, theme_id: t!.id, moment: n === 1 ? 0 : i % 12 })));
  return shoot.id as string;
}

/** Make every queued photo of a shoot, a few at a time. Failed photos give their credit back. */
export async function runShoot(shootId: string) {
  const db = admin();
  const { data: shoot } = await db.from("baby_shoots").select("*").eq("id", shootId).single();
  if (!shoot) return;
  const refs = await loadRefs(shoot.organization_id, shoot.ref_ids);
  const { data: photos } = await db.from("baby_photos").select("id").eq("shoot_id", shootId).eq("status", "queued").order("idx");
  const queue = [...(photos ?? [])];
  const worker = async () => { for (let p = queue.shift(); p; p = queue.shift()) await makePhoto(p.id, refs, shoot.shape as BabyShape); };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  await finishIfDone(shootId);
}

async function loadRefs(orgId: string, ids: string[]) {
  const { data } = await admin().from("baby_refs").select("storage_key").eq("organization_id", orgId).in("id", ids);
  const out: Buffer[] = [];
  for (const r of data ?? []) { try { out.push(await sharp(await getObject("uploads", r.storage_key)).resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer()); } catch { /* deleted photo */ } }
  return out;
}

async function finishIfDone(shootId: string) {
  const db = admin();
  const { count } = await db.from("baby_photos").select("id", { count: "exact", head: true }).eq("shoot_id", shootId).in("status", ["queued", "running"]);
  if (!count) await db.from("baby_shoots").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", shootId).eq("status", "running");
}

/** Make one photo. Two tries; after that the photo is marked failed and its credit returned. */
export async function makePhoto(photoId: string, refs: Buffer[], shape: BabyShape, opts: { remake?: boolean } = {}) {
  const db = admin();
  const { data: claimed } = await db.from("baby_photos").update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", photoId).in("status", opts.remake ? ["done"] : ["queued"]).select("*").maybeSingle();
  if (!claimed) return;
  const theme = babyTheme(claimed.theme_id)!;
  const m0 = claimed.moment as number;
  const state: BabyState = m0 % 3 === 2 ? "awake" : "asleep";
  const moment = Math.floor(m0 / 3) + (m0 % 3) + (opts.remake ? 5 : 0);
  const prompt = babyPrompt(theme, state, refs.length, moment, false, shape);
  const size = BABY_SIZES[shape];
  let lastCode = "failed";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (!env.openaiKey || !refs.length) throw Object.assign(new Error("not ready"), { status: 503 });
      const input = await Promise.all(refs.map((b, i) => toFile(b, `baby-${i}.png`, { type: "image/png" })));
      const res = (await openai().images.edit({ model: MODEL, prompt, image: input, size: `${size.width}x${size.height}`, quality: "medium", output_format: "png", n: 1 } as never, { timeout: 240_000, maxRetries: 0 })) as unknown as { data?: { b64_json?: string }[] };
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw Object.assign(new Error("empty"), { status: 502 });
      const jpeg = await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 93, chromaSubsampling: "4:4:4" }).toBuffer();
      const key = `baby/${claimed.organization_id}/${claimed.shoot_id}/${claimed.idx}${opts.remake ? "-b" : ""}.jpg`;
      await putObject("outputs", key, jpeg, "image/jpeg");
      await db.from("baby_photos").update(opts.remake
        ? { status: "done", first_key: claimed.storage_key, storage_key: key, remade: true, kept: "new", finished_at: new Date().toISOString() }
        : { status: "done", storage_key: key, finished_at: new Date().toISOString() }).eq("id", photoId);
      return;
    } catch (e) {
      const err = e as { status?: number; message?: string };
      const c = classifyHttpError(err.status, err.message ?? String(e));
      lastCode = c.code;
      if (!c.retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (opts.remake) {
    // The first take stays; the remake can be tried again later.
    await db.from("baby_photos").update({ status: "done", error_code: lastCode }).eq("id", photoId);
    return;
  }
  await db.from("baby_photos").update({ status: "failed", error_code: lastCode, finished_at: new Date().toISOString() }).eq("id", photoId);
  await refundPhoto(claimed.organization_id, photoId);
}

export async function refundPhoto(orgId: string, photoId: string) {
  const db = admin();
  const { error } = await db.rpc("grant_credits", {
    p_org: orgId, p_kind: "restored", p_entry_type: "adjustment_credit", p_quantity: 1, p_expires_at: null,
    p_source_type: "baby_failed_photo", p_source_ref: photoId, p_idempotency_key: `babyrefund:${photoId}`, p_note: "Photo didn't work, credit returned",
  });
  if (!error) await db.from("baby_photos").update({ refunded: true }).eq("id", photoId);
}

export async function shootView(orgId: string, shootId?: string) {
  const db = admin();
  let q = db.from("baby_shoots").select("id,shape,status,created_at,baby_photos(id,idx,theme_id,status,storage_key,first_key,kept,remade,refunded,feedback)").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (shootId) q = q.eq("id", shootId);
  const { data } = await q.limit(shootId ? 1 : 100);
  return (data ?? []).map((s) => ({ ...s, baby_photos: ((s as unknown as { baby_photos: { idx: number; status: string }[] }).baby_photos ?? []).filter((p) => p.status !== "deleted").sort((a, b) => a.idx - b.idx) }));
}

/** Erase everything Baby Shoot holds for this workspace. Paid orders and invoices stay, as tax law requires. */
export async function deleteBabyData(orgId: string) {
  const db = admin();
  const { data: refs } = await db.from("baby_refs").select("storage_key").eq("organization_id", orgId);
  const { data: photos } = await db.from("baby_photos").select("storage_key,first_key").eq("organization_id", orgId);
  const outKeys = (photos ?? []).flatMap((p) => [p.storage_key, p.first_key]).filter((k): k is string => !!k);
  if (refs?.length) await removeObjects("uploads", refs.map((r) => r.storage_key));
  if (outKeys.length) await removeObjects("outputs", outKeys);
  await db.from("baby_shoots").delete().eq("organization_id", orgId);
  await db.from("baby_refs").delete().eq("organization_id", orgId);
  await db.from("baby_profiles").delete().eq("organization_id", orgId);
}
