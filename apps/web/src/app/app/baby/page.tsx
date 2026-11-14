import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWeb } from "@/lib/auth";
import { BABY_EXAMPLE_FOLDER } from "@/lib/baby/themes";
import { integrations } from "@/lib/env";
import { publicUrl } from "@/lib/storage";
import { admin } from "@/lib/supabase";
import { BabyLab } from "./baby-lab";
import "./baby.css";

export const metadata: Metadata = { title: "Baby Shoot", robots: { index: false, follow: false } };

/** Example photos already made for the theme cards (theme id to public link). */
async function loadExamples(): Promise<Record<string, string>> {
  try {
    const { data } = await admin().storage.from("public").list(BABY_EXAMPLE_FOLDER, { limit: 200 });
    const out: Record<string, string> = {};
    for (const f of data ?? []) if (f.name.endsWith(".webp")) out[f.name.slice(0, -5)] = `${publicUrl(`${BABY_EXAMPLE_FOLDER}/${f.name}`)}?v=${encodeURIComponent(f.updated_at ?? "")}`;
    return out;
  } catch { return {}; }
}

/** Photos this workspace has already made, newest first. */
async function loadSaved(orgId: string): Promise<{ key: string; themeId: string }[]> {
  try {
    const { data } = await admin().storage.from("outputs").list(`baby/${orgId}`, { limit: 60, sortBy: { column: "name", order: "desc" } });
    return (data ?? []).filter((f) => /^\d+-[a-z-]+\.jpg$/.test(f.name)).map((f) => ({ key: `baby/${orgId}/${f.name}`, themeId: f.name.replace(/^\d+-/, "").slice(0, -4) }));
  } catch { return []; }
}

/**
 * Baby Shoot inside the signed-in app. Platform accounts only for now:
 * it does not charge credits yet, so it must not be open to customers.
 */
export default async function BabyPage() {
  const ctx = await requireWeb();
  if (!ctx.platformRole) notFound();
  const [examples, saved] = await Promise.all([loadExamples(), loadSaved(ctx.orgId)]);
  return <BabyLab live={integrations.openai} examples={examples} saved={saved} canManage />;
}
