/**
 * Two-workspace authorization tests (IDOR). Workspace A and workspace B each own a product,
 * a shoot, a photo, a project and a bulk shoot. Every server function is called as A with B's
 * ids and must refuse, and called with A's own ids and must work.
 * The fake database really applies the filters the code sends, so a missing
 * `.eq("organization_id", ...)` makes these tests fail.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as { table: string; op: string; rows: Row[] }[], storage: [] as string[] }));

vi.mock("@/lib/auth", () => ({
  assertRole: (ctx: { role: string }, min: string) => {
    const rank: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
    if (rank[ctx.role] < rank[min]) throw Object.assign(new Error("forbidden"), { status: 403 });
  },
}));
vi.mock("@/lib/api", () => ({ ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("@/lib/credits", () => ({ isTrialOrg: async () => false }));
vi.mock("@/lib/settings", () => ({ getFlag: async () => true, getSettings: async () => ({ credit_policy: { maxImagesPerJob: 4, trialWatermark: false, creditsPerImage: 1, freeRemakes: 1 } }) }));
vi.mock("@/lib/observe", () => ({ audit: vi.fn(), track: vi.fn(), rateLimit: async () => true, logError: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { cronSecret: "" } }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  getObject: async (_b: string, key: string) => { db.storage.push(key); throw new Error("storage read " + key); },
  putObject: vi.fn(), removeObjects: vi.fn(), signedUrls: async () => ({}), signedUrl: async () => "", sized: (u: string) => u,
}));

vi.mock("@/lib/supabase", () => ({
  admin: () => ({
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let op = "select"; let payload: Row | Row[] | null = null;
      const rows = () => (db.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const run = () => {
        const hit = rows();
        if (op === "update") { hit.forEach((r) => Object.assign(r, payload)); db.writes.push({ table, op, rows: hit }); return hit; }
        if (op === "delete") { db.tables[table] = (db.tables[table] ?? []).filter((r) => !hit.includes(r)); db.writes.push({ table, op, rows: hit }); return hit; }
        if (op === "insert") { const list = (Array.isArray(payload) ? payload : [payload]) as Row[]; const made = list.map((r) => ({ id: `new-${table}-${(db.tables[table] ?? []).length}`, ...r })); (db.tables[table] ??= []).push(...made); db.writes.push({ table, op, rows: made }); return made; }
        return hit;
      };
      const chain: Record<string, unknown> = {
        select: () => chain, order: () => chain, limit: () => chain, range: () => chain, not: () => chain, gte: () => chain, or: () => chain, ilike: () => chain,
        eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return chain; },
        neq: (k: string, v: unknown) => { filters.push((r) => r[k] !== v); return chain; },
        in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return chain; },
        is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return chain; },
        insert: (v: Row | Row[]) => { op = "insert"; payload = v; return chain; },
        update: (v: Row) => { op = "update"; payload = v; return chain; },
        delete: () => { op = "delete"; return chain; },
        upsert: (v: Row | Row[]) => { op = "insert"; payload = v; return chain; },
        maybeSingle: async () => { const r = run(); return { data: r[0] ?? null, error: null }; },
        single: async () => { const r = run(); return r[0] ? { data: r[0], error: null } : { data: null, error: { message: "no rows" } }; },
        then: (resolve: (v: unknown) => unknown) => { const r = run(); return resolve({ data: r, error: null, count: r.length }); },
      };
      return chain;
    },
  }),
}));

import type { AuthContext } from "@/lib/auth";
import { cancelJob, createJob, jobView, remakeAsset, retryItem, editAsset } from "@/lib/jobs";
import { downloadAsset, exportZip, setApproval, reportAsset } from "@/lib/assets";
import { addProductPhotos, deleteProductPhoto, updateProduct } from "@/lib/products";

const A = { orgId: "org-a", userId: "user-a", via: "web", role: "owner" } as AuthContext;
const viewerA = { ...A, role: "viewer" } as AuthContext;

function seed() {
  db.writes = []; db.storage = [];
  const ws = (o: string) => ({
    product: { id: `prod-${o}`, organization_id: `org-${o}`, name: `Product ${o}`, category: "beauty", archived_at: null, attributes: {}, locks: [], must_not_change: null },
    asset: { id: `asset-${o}`, organization_id: `org-${o}`, product_id: `prod-${o}`, job_id: `job-${o}`, item_id: `item-${o}`, storage_key: `${o}/out.png`, quality_status: "pass", approval_status: "pending", watermarked: false, remakes_used: 0, delivered_at: new Date().toISOString(), products: { id: `prod-${o}`, name: `Product ${o}`, shopify_product_id: null }, generation_jobs: { mode: "preserve", style: "neutral_studio", output: "square", custom_brief: null, project_id: null, settings: {} }, generation_items: { style: "neutral_studio" } },
    job: { id: `job-${o}`, organization_id: `org-${o}`, product_id: `prod-${o}`, status: "completed", style: "neutral_studio", output: "square", mode: "preserve", idempotency_key: `k-${o}`, products: { id: `prod-${o}`, name: `Product ${o}` } },
    item: { id: `item-${o}`, organization_id: `org-${o}`, job_id: `job-${o}`, status: "failed", style: "neutral_studio", params: {}, idx: 0, generation_jobs: { id: `job-${o}`, product_id: `prod-${o}`, mode: "preserve", style: "neutral_studio", output: "square", custom_brief: null, project_id: null, parent_asset_id: null, settings: {} } },
    photo: { id: `photo-${o}`, organization_id: `org-${o}`, product_id: `prod-${o}`, storage_key: `org-${o}/prod-${o}/p.jpg`, view_type: "front", cutout_key: null },
    project: { id: `project-${o}`, organization_id: `org-${o}`, name: "P" },
    batch: { id: `batch-${o}`, organization_id: `org-${o}`, name: "B" },
  });
  const a = ws("a"), b = ws("b");
  db.tables = {
    products: [a.product, b.product], generated_assets: [a.asset, b.asset], generation_jobs: [a.job, b.job],
    generation_items: [a.item, b.item], product_assets: [a.photo, b.photo, { ...a.photo, id: "photo-a2", view_type: "back" }],
    projects: [a.project, b.project], batches: [a.batch, b.batch], refund_requests: [],
  };
}

const status = async (p: Promise<unknown>) => p.then(() => 200, (e: { status?: number }) => e.status ?? 500);
const wroteTo = (id: string) => db.writes.some((w) => w.op !== "insert" && w.rows.some((r) => r.id === id));

beforeEach(seed);

describe("workspace A cannot reach workspace B", () => {
  it("cannot read B's shoot", async () => {
    expect(await jobView("org-a", "job-b")).toBeNull();
    expect(await jobView("org-a", "job-a")).not.toBeNull();
  });
  it("cannot download, approve, report or zip B's photo", async () => {
    expect(await status(downloadAsset(A, "asset-b", "png", "full"))).toBe(404);
    expect(await status(setApproval(A, "asset-b", "approved"))).toBe(404);
    expect(await status(reportAsset(A, "asset-b", { reason: "label_changed" } as never))).toBe(404);
    expect(db.storage).not.toContain("b/out.png");
    expect(wroteTo("asset-b")).toBe(false);
    await exportZip(A, ["asset-b"], "jpg").catch(() => null);
    expect(db.storage).not.toContain("b/out.png");
  });
  it("can approve its own photo", async () => {
    expect(await status(setApproval(A, "asset-a", "approved"))).toBe(200);
    expect(db.tables.generated_assets.find((r) => r.id === "asset-a")!.approval_status).toBe("approved");
  });
  it("cannot remake, edit, retry or cancel B's work", async () => {
    expect(await status(remakeAsset(A, "asset-b", "idem-remake-1"))).toBe(404);
    expect(await status(editAsset(A, "asset-b", "make it warmer", "idem-edit-1"))).toBe(404);
    expect(await status(retryItem(A, "job-b", "item-b", "idem-retry-1"))).toBe(404);
    expect(await status(cancelJob(A, "job-b"))).toBe(404);
    expect(wroteTo("job-b")).toBe(false);
    expect(db.writes.filter((w) => w.op === "insert" && w.table === "generation_jobs")).toHaveLength(0);
  });
  it("cannot start a shoot of B's product, or file it under B's project or bulk shoot", async () => {
    const base = { mode: "preserve", style: "neutral_studio", output: "square", count: 1 } as const;
    expect(await status(createJob(A, { ...base, productId: "prod-b", idempotencyKey: "idem-job-1" }))).toBe(404);
    expect(await status(createJob(A, { ...base, productId: "prod-a", projectId: "project-b", idempotencyKey: "idem-job-2" }))).toBe(404);
    expect(await status(createJob(A, { ...base, productId: "prod-a", batchId: "batch-b", idempotencyKey: "idem-job-3" }))).toBe(404);
    expect(db.writes.filter((w) => w.op === "insert" && w.table === "generation_jobs")).toHaveLength(0);
  });
  it("can file a shoot under its own project", async () => {
    const base = { mode: "preserve", style: "neutral_studio", output: "square", count: 1 } as const;
    await createJob(A, { ...base, productId: "prod-a", projectId: "project-a", idempotencyKey: "idem-job-4" }).catch(() => null);
    const made = db.writes.find((w) => w.op === "insert" && w.table === "generation_jobs");
    expect(made?.rows[0]).toMatchObject({ organization_id: "org-a", project_id: "project-a" });
  });
  it("cannot change, add photos to, or delete photos of B's product", async () => {
    expect(await status(updateProduct(A, "prod-b", { name: "hacked" }))).toBe(404);
    expect(await status(addProductPhotos(A, "prod-b", [{ key: "org-a/x", viewType: "angle" }]))).toBe(404);
    expect(await status(deleteProductPhoto(A, "photo-b"))).toBe(404);
    expect(db.tables.products.find((r) => r.id === "prod-b")!.name).toBe("Product b");
    expect(db.tables.product_assets.some((r) => r.id === "photo-b")).toBe(true);
  });
  it("cannot attach B's uploaded files to its own product", async () => {
    expect(await status(addProductPhotos(A, "prod-a", [{ key: "org-b/stolen", viewType: "angle" }]))).toBe(403);
    expect(db.storage).not.toContain("org-b/stolen");
  });
  it("viewers cannot change anything", async () => {
    expect(await status(setApproval(viewerA, "asset-a", "approved"))).toBe(403);
    expect(await status(updateProduct(viewerA, "prod-a", { name: "x" }))).toBe(403);
    expect(await status(cancelJob(viewerA, "job-a"))).toBe(403);
  });
});
