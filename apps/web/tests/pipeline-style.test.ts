import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ edit: vi.fn(), judge: vi.fn(), cutout: vi.fn(), canvas: vi.fn(), composite: vi.fn(), put: vi.fn(), rpc: vi.fn(), assets: vi.fn(), checks: vi.fn(), patches: vi.fn(), image: Buffer.alloc(0), studio:false, direct:vi.fn() }));
const shot = { scene: "A dry natural rock ledge in an open-air mountain landscape with visible sky", lighting: "Outdoor daylight", framing: "full", human_presence: "none", product_scale: 0.65, offset_x: 0, baseline: 0.85 };
vi.mock("@/lib/supabase", () => ({ admin: () => ({ rpc: f.rpc, from: (table: string) => {
  let value: unknown; let op = "read"; let selection = "";
  const chain = {
    select: (s = "") => { selection = s; return chain; }, eq: () => chain, neq: () => chain, order: () => chain, limit: () => chain, is: () => chain, in: () => chain,
    insert: (v: unknown) => { value = v; op = "insert"; if (table === "generated_assets") f.assets(v); if (table === "quality_checks") f.checks(v); return chain; },
    update: (v: unknown) => { op = "update"; value = v; if (table === "generation_items") f.patches(v); return chain; },
    single: async () => ({ data: table === "generation_jobs" ? { id: "job", organization_id: "org", product_id: "p", mode: "preserve", style: "natural_sunlight", output: "square", settings: f.studio ? {recipe:categoryLook("studio-front"),subjectCount:2} : { shootStyle: "outdoor" }, is_trial: true, status: "generating", created_by: "u" } : table === "products" ? { id: "p", name: "Bottle", category: "home_kitchen", locks: [] } : table === "generation_items" ? { style: "natural_sunlight", params: f.studio?{shot:studioDirection(categoryLook("studio-front")!),lookId:"studio-front"}:{shot} } : { id: "new-id" }, error: null }),
    maybeSingle: async () => ({ data: { rate: 83, rate_date: "2026-10-27" } }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: op !== "read" ? value : table === "product_assets" ? [{ id: "ref", view_type: "front", storage_key: "original" }] : table === "generation_items" && selection.includes("idx") ? [{ id: "item", idx: 0, style: "natural_sunlight", params: { shot } }] : [], error: null }),
  }; return chain;
} }) }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ providers: { render: { trialEdge: 1024, paidEdge: 1536 }, llm: { models: [] }, costUsdPerImage: {}, timeoutMs: 5000 }, quality: { useJudge: true }, fx_fallback: { USDINR: 83 } }) }));
vi.mock("@/lib/prep", () => ({ analyzeProduct: async () => null, directShots: f.direct, getCutout: f.cutout }));
vi.mock("@/lib/storage", () => ({ getObject: async () => f.image, putObject: f.put }));
vi.mock("@/lib/images", () => ({ isBlank: async () => false, dimensions: async () => ({ width: 1024, height: 1024 }), thumbnail: async () => Buffer.from("thumb") }));
vi.mock("@/lib/compose", () => ({ renderCanvas: f.canvas, finishComposite: f.composite, layoutProduct: vi.fn() }));
vi.mock("@/lib/providers", () => ({ getProvider: () => ({ edit: f.edit }), providerChain: () => ["openai"], modelFor: () => "test", isConfigured: () => true, ProviderError: class extends Error {} }));
vi.mock("@/lib/llm", () => ({ jsonCall: f.judge }));
vi.mock("@/lib/jobs", () => ({ refreshJobStatus: async () => "completed" }));
vi.mock("@/lib/observe", () => ({ track: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/env", () => ({ integrations: { openai: true }, env: {} }));
vi.mock("@/lib/email", () => ({ notifyJobDone: async () => undefined }));
import {categoryLook,studioDirection} from "@packshot/core";
import { processItem } from "@/lib/pipeline";
const verdict = { same_product: true, text_changed: false, logo_changed: false, colour_changed: false, shape_changed: false, extra_or_missing_items: false, artefacts: false, notes: "", photographic: true, natural_anatomy: true, brief_followed: true, style_match: true, environment: "outdoor", human_visible: false, framing_match: true };
const item = { id: "item", job_id: "job", organization_id: "org", idx: 0, attempts: 0, max_attempts: 3 };
beforeEach(async () => {
  vi.clearAllMocks();f.studio=false;
  f.image = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#336699" } }).png().toBuffer();
  f.edit.mockResolvedValue({ image: f.image, model: "test", costUsd: 0.01 });
  f.judge.mockResolvedValue({ data: verdict });
  f.rpc.mockResolvedValue({ data: true });
});
describe("selected style production pipeline", () => {
  it("uses a fixed studio contract without any paid shot-planner call",async()=>{
    f.studio=true;f.judge.mockResolvedValue({data:{...verdict,environment:"studio",reference_product_count:2,output_product_count:2,studio_view_match:true}});
    await processItem({...item,max_attempts:1});
    expect(f.direct).not.toHaveBeenCalled();expect(f.edit).toHaveBeenCalledTimes(1);
    expect(f.edit.mock.calls[0][0].prompt).toContain("Exactly 2 product unit(s)");
    expect(f.edit.mock.calls[0][0].prompt).toContain("Remove the original hands");
    expect(f.assets.mock.calls[0][0]).toMatchObject({quality_status:"pass"});
  });
  it("blocks an invented third product unit and releases credit without regenerating",async()=>{
    f.studio=true;f.judge.mockResolvedValue({data:{...verdict,environment:"studio",reference_product_count:2,output_product_count:3,studio_view_match:true}});
    await processItem({...item,max_attempts:1});
    expect(f.edit).toHaveBeenCalledTimes(1);expect(f.rpc).toHaveBeenCalledWith("settle_item",{p_item:"item",p_capture:false});
    expect(f.checks.mock.calls[0][0]).toContainEqual(expect.objectContaining({check_type:"product_inventory",decision:"fail"}));
  });
  it("does not reject imaginary anatomy when no person appears",async()=>{
    f.judge.mockResolvedValue({data:{...verdict,natural_anatomy:false,human_visible:false}});
    await processItem({...item,max_attempts:1});expect(f.assets.mock.calls[0][0]).toMatchObject({quality_status:"pass"});
  });

  it("rejects altered fabric or design details without capturing credit", async () => {
    f.judge.mockResolvedValue({data:{...verdict,design_changed:true}});
    await processItem({ ...item, max_attempts: 1 });
    expect(f.rpc).toHaveBeenCalledWith("settle_item",{p_item:"item",p_capture:false});
    expect(f.assets.mock.calls[0][0]).toMatchObject({quality_status:"fail"});
  });
  it("uses original references without a cutout and delivers even queued trial jobs without watermarking", async () => {
    await processItem(item);
    expect(f.cutout).not.toHaveBeenCalled(); expect(f.canvas).not.toHaveBeenCalled(); expect(f.composite).not.toHaveBeenCalled();
    expect(f.edit).toHaveBeenCalledTimes(1);
    expect(f.edit.mock.calls[0][0].prompt).toContain("outdoor");
    expect(f.edit.mock.calls[0][0].images).toHaveLength(1);
    expect(f.assets.mock.calls[0][0]).toMatchObject({ watermarked: false, quality_status: "pass" });
    const delivered = f.put.mock.calls.find(c => String(c[1]).endsWith("0-1.png"))![2];
    expect(await sharp(delivered).raw().toBuffer()).toEqual(await sharp(f.image).raw().toBuffer());
    expect(f.rpc).toHaveBeenCalledWith("settle_item", { p_item: "item", p_capture: true });
  });
  it("tries an indoor image once more, then rejects it and releases the credit", async () => {
    f.judge.mockResolvedValue({ data: { ...verdict, environment: "indoor" } });
    await processItem(item);
    expect(f.rpc).not.toHaveBeenCalledWith("settle_item", { p_item: "item", p_capture: false });
    expect(f.patches.mock.calls).not.toContainEqual([expect.objectContaining({ status: "failed" })]);
    vi.clearAllMocks(); f.judge.mockResolvedValue({ data: { ...verdict, environment: "indoor" } });
    await processItem({ ...item, attempts: 2 });
    expect(f.edit).toHaveBeenCalledTimes(1);
    expect(f.assets.mock.calls[0][0]).toMatchObject({ quality_status: "fail", approval_status: "rejected" });
    expect(f.checks.mock.calls[0][0]).toContainEqual(expect.objectContaining({ check_type: "style_adherence", decision: "fail" }));
    expect(f.rpc).toHaveBeenCalledWith("settle_item", { p_item: "item", p_capture: false });
    expect(f.rpc).not.toHaveBeenCalledWith("settle_item", { p_item: "item", p_capture: true });
    expect(f.patches.mock.calls).toContainEqual([expect.objectContaining({ status: "failed" })]);
  });
});
