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

/**
 * Baby Shoot inside the signed-in app. Platform accounts only for now:
 * it does not charge credits yet, so it must not be open to customers.
 */
export default async function BabyPage() {
  const ctx = await requireWeb();
  if (!ctx.platformRole) notFound();
  return <BabyLab live={integrations.openai} examples={await loadExamples()} canManage />;
}
