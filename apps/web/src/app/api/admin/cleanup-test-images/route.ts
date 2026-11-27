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

export async function GET(req: Request) {
  try { await requirePlatform("platform_admin"); } catch { return page("<p>Sign in to PocketShoot as a platform admin first, then open this page again.</p>"); }
  let list; try { list = await targets(); } catch (e) { return page(`<p>Couldn't list files: ${String((e as Error).message)}</p>`); }
  const q = new URL(req.url).searchParams;
  if (q.get("list") === "1") {
    // Download links for the backup, valid for 3 hours. Admin only.
    const storage = admin().storage.from("outputs");
    const files: { name: string; size: number; url: string }[] = [];
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const { data } = await storage.createSignedUrls(chunk.map((f) => f.name), 3 * 3600);
      (data ?? []).forEach((d, k) => { if (d.signedUrl) files.push({ name: chunk[k].name, size: chunk[k].size, url: d.signedUrl }); });
    }
    return new Response(JSON.stringify({ files }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  if (q.get("backedup") !== "1") {
    const mb0 = Math.round(list.reduce((a, f) => a + f.size, 0) / 1048576);
    return page(`<h1>Back up test images</h1><p>${list.length} PNG test images (${mb0} MB). Press the button and keep this tab open. They download as a few zip files (about 300 MB each) into your Downloads folder.</p>
<button id="go" style="font:inherit;padding:12px 20px;border-radius:999px;border:0;background:#1c1b18;color:#fff">Download backup</button>
<p id="st" style="color:#67625a"></p>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
document.getElementById('go').onclick=async()=>{const b=document.getElementById('go'),st=document.getElementById('st');b.disabled=true;
  st.textContent='Getting the list';const {files}=await (await fetch('?list=1')).json();
  let zip=new JSZip(),size=0,part=1,done=0,failed=[];
  const save=async()=>{st.textContent='Saving part '+part;const blob=await zip.generateAsync({type:'blob',compression:'STORE'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pocketshoot-test-images-part-'+String(part).padStart(2,'0')+'.zip';document.body.append(a);a.click();a.remove();await new Promise(r=>setTimeout(r,4000));URL.revokeObjectURL(a.href);zip=new JSZip();size=0;part++};
  for(const f of files){let ok=false;for(let t=0;t<3&&!ok;t++){try{const r=await fetch(f.url);if(!r.ok)throw 0;const buf=await r.arrayBuffer();zip.file(f.name,buf);size+=buf.byteLength;ok=true}catch(e){}}
    if(!ok)failed.push(f.name);done++;st.textContent='Downloaded '+done+' of '+files.length;if(size>300*1048576)await save()}
  if(size)await save();
  st.innerHTML=(failed.length?'<b>'+failed.length+' files could not be downloaded.</b> Press the button again to retry. ':'<b>All '+files.length+' images saved in '+(part-1)+' zip files.</b> ')+'Tell Claude it is done.';b.disabled=false};
</script>`);
  }
  const mb = Math.round(list.reduce((a, f) => a + f.size, 0) / 1048576);
  return page(`<h1>Clean up test images</h1><p>This permanently deletes <b>${list.length} PNG test images (${mb} MB)</b> made by the team's own accounts before 13 Nov 2026. Nothing from customers and nothing from Baby Shoot is touched.</p>
<form method="post"><input type="hidden" name="backedup" value="1"><button style="font:inherit;padding:12px 20px;border-radius:999px;border:0;background:#cf3a3a;color:#fff">Delete ${list.length} images</button></form>`);
}

export async function POST(req: Request) {
  try { await requirePlatform("platform_admin"); } catch { return page("<p>Sign in as a platform admin first.</p>"); }
  const form = await req.formData().catch(() => null);
  if (form?.get("backedup") !== "1") return page("<p>Back up the images first.</p>");
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
