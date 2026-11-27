import { getApiContext } from "@/lib/auth";
import { admin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const rs = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A Baby Shoot GST invoice as a printable page, for its owner only. */
export async function GET(req: Request, route: { params: Promise<{ id: string }> }) {
  let ctx; try { ctx = await getApiContext(req); } catch { return new Response("Sign in to continue", { status: 401 }); }
  const { id } = await route.params;
  const { data: inv } = await admin().from("invoices").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!inv) return new Response("Not found", { status: 404 });
  const s = inv.seller as Record<string, string>;
  const b = inv.buyer as Record<string, string | null>;
  const t = inv.tax as { cgstPaise: number; sgstPaise: number; igstPaise: number; ratePercent: number; inWords: string; taxablePaise: number };
  const lines = inv.lines as { description: string; sac: string; taxableMinor: number }[];
  const half = (t.ratePercent ?? 18) / 2;
  const taxRows = t.igstPaise
    ? `<tr><td>IGST ${t.ratePercent}%</td><td></td><td>${rs(t.igstPaise)}</td></tr>`
    : `<tr><td>CGST ${half}%</td><td></td><td>${rs(t.cgstPaise)}</td></tr><tr><td>SGST ${half}%</td><td></td><td>${rs(t.sgstPaise)}</td></tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(inv.number)}</title>
<style>body{font:14px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1b18;margin:0;padding:24px;background:#fff}main{max-width:720px;margin:auto}
h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px 0;border-bottom:1px solid #e9e5dc;text-align:left;vertical-align:top}
td:last-child,th:last-child{text-align:right}.muted{color:#67625a}.grid{display:flex;flex-wrap:wrap;gap:24px;justify-content:space-between;margin-top:20px}
.tot td{font-weight:700;border-bottom:0;font-size:16px}button{margin-top:24px;font:inherit;padding:10px 18px;border-radius:999px;border:1px solid #1c1b18;background:#fff}
@media print{button{display:none}body{padding:0}}</style></head><body><main>
<div class="grid" style="margin-top:0"><div><h1>Tax invoice</h1><div class="muted">No. ${esc(inv.number)} · ${new Date(inv.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div></div>
<div style="text-align:right"><b>${esc(s.legalName || s.tradeName)}</b><br><span class="muted">Baby Shoot</span>${s.address ? `<br><span class="muted" style="white-space:pre-line">${esc(s.address)}</span>` : ""}${s.gstin ? `<br>GSTIN ${esc(s.gstin)}` : ""}${s.email ? `<br>${esc(s.email)}` : ""}</div></div>
<div class="grid"><div><div class="muted">Billed to</div><b>${esc(b.name)}</b>${b.gstin ? `<br>GSTIN ${esc(b.gstin)}` : ""}</div><div style="text-align:right"><div class="muted">Place of supply</div>${esc(b.placeOfSupply)}<div class="muted" style="margin-top:6px">Reverse charge: No</div></div></div>
<table><thead><tr><th>Description</th><th>SAC</th><th>Taxable value</th></tr></thead><tbody>
${lines.map((l) => `<tr><td>${esc(l.description)}</td><td>${esc(l.sac)}</td><td>${rs(l.taxableMinor)}</td></tr>`).join("")}
${taxRows}<tr class="tot"><td>Total paid</td><td></td><td>${rs(inv.total_minor)}</td></tr></tbody></table>
<p class="muted">${esc(t.inWords)}</p>
<button onclick="print()">Save as PDF or print</button></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}
