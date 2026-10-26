import "server-only";
import { admin } from "./supabase";

let cache: { at: number; value: Record<string, string> } | null = null;

/** Real example photos for each scene, made by the engine and published by an admin. */
export async function getScenePreviews(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const { data } = await admin().from("app_settings").select("value").eq("key", "scene_previews").maybeSingle();
  cache = { at: Date.now(), value: (data?.value as Record<string, string>) ?? {} };
  return cache.value;
}

export async function saveScenePreviews(map: Record<string, string>) {
  await admin().from("app_settings").upsert({ key: "scene_previews", value: map, updated_at: new Date().toISOString() });
  cache = null;
}
