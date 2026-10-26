import "server-only";
import { admin } from "./supabase";
import type { Bucket } from "./storage";

/** Deletes every object under a prefix (folders are walked recursively). */
export async function removePrefix(bucket: Bucket, prefix: string): Promise<number> {
  const storage = admin().storage.from(bucket);
  let removed = 0;
  const walk = async (path: string) => {
    for (let offset = 0; ; offset += 1000) {
      const { data } = await storage.list(path, { limit: 1000, offset });
      if (!data?.length) break;
      const files = data.filter((d) => d.id).map((d) => `${path}/${d.name}`);
      const folders = data.filter((d) => !d.id).map((d) => `${path}/${d.name}`);
      if (files.length) {
        await storage.remove(files);
        removed += files.length;
      }
      for (const f of folders) await walk(f);
      if (data.length < 1000) break;
    }
  };
  await walk(prefix);
  return removed;
}

/** Applies the retention settings: removes stale uploads and old failed outputs. */
export async function applyRetention(failedDays: number) {
  const db = admin();
  const cutoff = new Date(Date.now() - failedDays * 86_400_000).toISOString();
  const { data: failed } = await db.from("generated_assets").select("id, storage_key").eq("quality_status", "fail").lt("created_at", cutoff).limit(500);
  if (failed?.length) {
    await admin().storage.from("outputs").remove(failed.map((f) => f.storage_key));
    await db.from("generated_assets").delete().in("id", failed.map((f) => f.id));
  }
  return { failedRemoved: failed?.length ?? 0 };
}
