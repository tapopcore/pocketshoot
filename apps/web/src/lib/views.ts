import "server-only";
import { admin } from "./supabase";
import { signedUrls } from "./storage";

/** Adds short-lived signed URLs to asset rows for display. */
export async function withAssetUrls<T extends { storage_key: string; thumb_key?: string | null }>(rows: T[]) {
  const keys = rows.flatMap((r) => [r.storage_key, r.thumb_key ?? ""]).filter(Boolean);
  const urls = await signedUrls("outputs", keys, 3600);
  return rows.map((r) => ({ ...r, url: urls[r.storage_key] ?? null, thumbUrl: (r.thumb_key && urls[r.thumb_key]) || urls[r.storage_key] || null }));
}

export async function withRefUrls<T extends { storage_key: string }>(rows: T[]) {
  const urls = await signedUrls("originals", rows.map((r) => r.storage_key), 3600);
  return rows.map((r) => ({ ...r, url: urls[r.storage_key] ?? null }));
}

/** Products with their first photo, newest first. */
export async function productList(orgId: string, opts: { q?: string | null; limit?: number; offset?: number; includeArchived?: boolean } = {}) {
  let query = admin()
    .from("products")
    .select("id, name, category, sku, source, shopify_product_id, created_at, archived_at, product_assets(id, storage_key, view_type, created_at)", { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 24) - 1);
  if (!opts.includeArchived) query = query.is("archived_at", null);
  if (opts.q) query = query.or(`name.ilike.%${opts.q.replace(/[%,()]/g, "")}%,sku.ilike.%${opts.q.replace(/[%,()]/g, "")}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as { id: string; name: string; category: string; sku: string | null; source: string; shopify_product_id: string | null; created_at: string; archived_at: string | null; product_assets: { id: string; storage_key: string; view_type: string }[] }[];
  const covers = rows.map((r) => r.product_assets.find((a) => a.view_type === "front") ?? r.product_assets[0]).filter(Boolean);
  const urls = await signedUrls("originals", covers.map((c) => c.storage_key), 3600);
  return {
    total: count ?? 0,
    products: rows.map((r) => {
      const cover = r.product_assets.find((a) => a.view_type === "front") ?? r.product_assets[0];
      return { id: r.id, name: r.name, category: r.category, sku: r.sku, source: r.source, shopifyProductId: r.shopify_product_id, createdAt: r.created_at, archived: !!r.archived_at, photoCount: r.product_assets.length, coverUrl: cover ? urls[cover.storage_key] ?? null : null };
    }),
  };
}

export async function recentJobs(orgId: string, limit = 12, offset = 0, filter: { productId?: string; batchId?: string; q?: string | null; status?: "ready" | "creating" | "failed" | null } = {}) {
  const term = filter.q?.trim().replace(/[%,()]/g, " ").slice(0, 60);
  let q = admin()
    .from("generation_jobs")
    .select(`id, status, mode, style, output, requested_count, created_at, is_trial, source, products${term ? "!inner" : ""}(id, name), generated_assets!generated_assets_job_id_fkey(id, thumb_key, storage_key, quality_status)`)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filter.productId) q = q.eq("product_id", filter.productId);
  if (filter.batchId) q = q.eq("batch_id", filter.batchId);
  if (term) q = q.ilike("products.name", `%${term}%`);
  if (filter.status === "ready") q = q.in("status", ["completed", "review_needed"]);
  if (filter.status === "creating") q = q.in("status", ["queued", "preparing", "generating", "checking"]);
  if (filter.status === "failed") q = q.eq("status", "failed");
  const { data } = await q;
  const rows = (data ?? []) as unknown as { id: string; status: string; mode: string; style: string; output: string; requested_count: number; created_at: string; is_trial: boolean; source: string; products: { id: string; name: string }; generated_assets: { id: string; thumb_key: string | null; storage_key: string; quality_status: string }[] }[];
  const thumbs = rows.flatMap((r) => r.generated_assets.filter((a) => a.quality_status !== "fail").slice(0, 4).map((a) => a.thumb_key ?? a.storage_key));
  const urls = await signedUrls("outputs", thumbs, 3600);
  return rows.map((r) => ({
    id: r.id, status: r.status, mode: r.mode, style: r.style, output: r.output, count: r.requested_count, createdAt: r.created_at, isTrial: r.is_trial, source: r.source,
    product: r.products,
    thumbs: r.generated_assets.filter((a) => a.quality_status !== "fail").slice(0, 4).map((a) => urls[a.thumb_key ?? a.storage_key]).filter(Boolean),
  }));
}
