import { requirePlatform } from "@/lib/auth";
import { admin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-off clean-up approved on 27 Nov 2026: the large PNG test images made by the team's own accounts
 * between 26 Oct and 12 Nov 2026 pushed storage over the Supabase free plan. Only those files are removed.
 */
const TEAM_ORGS = [
  "e0053f09-5703-472e-be98-aa0951a7daef", // iamdhruvguptaa
  "22568fb1-7ab8-433e-a1a9-070e03064809", // makemyapp.co
  "935052aa-4535-4661-9517-7c41df2b5852", // mittal.himanshi31
  "43550b6d-c533-4a5e-90f5-762aa06a9665", // tapopcoreteam
];
const BEFORE = "2026-11-13T00:00:00Z";

async function targets() {
  const storage = admin().storage.from("outputs");
  const out: { name: string; size: number }[] = [];
  const walk = async (path: string) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(path, { limit: 1000, offset });
      if (error) throw error;
      if (!data?.length) break;
      for (const d of data) {
        const full = `${path}/${d.name}`;
        if (!d.id) { await walk(full); continue; }
        const m = (d.metadata ?? {}) as { mimetype?: string; size?: number };
        if (m.mimetype === "image/png" && d.created_at && d.created_at < BEFORE) out.push({ name: full, size: Number(m.size ?? 0) });
      }
      if (data.length < 1000) break;
    }
  };
  for (const org of TEAM_ORGS) await walk(org);
  return out;
}

const page = (body: string) => new Response(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Clean up test images</title><body style="font:16px/1.5 system-ui;max-width:560px;margin:40px auto;padding:0 16px">${body}</body>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export async function GET() {
  try { await requirePlatform("platform_admin"); } catch { return page("<p>Sign in to PocketShoot as a platform admin first, then open this page again.</p>"); }
  let list; try { list = await targets(); } catch (e) { return page(`<p>Couldn't list files: ${String((e as Error).message)}</p>`); }
  const mb = Math.round(list.reduce((a, f) => a + f.size, 0) / 1048576);
  return page(`<h1>Clean up test images</h1><p>This permanently deletes <b>${list.length} PNG test images (${mb} MB)</b> made by the team's own accounts before 13 Nov 2026. Nothing from customers and nothing from Baby Shoot is touched.</p>
<form method="post"><button style="font:inherit;padding:12px 20px;border-radius:999px;border:0;background:#cf3a3a;color:#fff">Delete ${list.length} images</button></form>`);
}

export async function POST() {
  try { await requirePlatform("platform_admin"); } catch { return page("<p>Sign in as a platform admin first.</p>"); }
  const list = await targets();
  const storage = admin().storage.from("outputs");
  let removed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const { data, error } = await storage.remove(list.slice(i, i + 100).map((f) => f.name));
    if (error) return page(`<p>Stopped after ${removed} images: ${error.message}. Open the page again to continue.</p>`);
    removed += data?.length ?? 0;
  }
  return page(`<h1>Done</h1><p>Deleted ${removed} test images. Storage usage updates in Supabase within an hour.</p>`);
}
