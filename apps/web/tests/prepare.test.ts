import { beforeEach, describe, expect, it, vi } from "vitest";
const fakes = vi.hoisted(() => ({ analyze: vi.fn(), getCutout: vi.fn(), after: vi.fn(), heroState: vi.fn() }));
vi.mock("next/server", () => ({ after: fakes.after }));
vi.mock("@/lib/api", () => ({ handler: (fn: unknown) => fn, ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("@/lib/auth", () => ({ assertRole: vi.fn() }));
vi.mock("@/lib/prep", () => ({ analyzeProduct: fakes.analyze, getCutout: fakes.getCutout }));
vi.mock("@/lib/hero", () => ({ heroState: fakes.heroState }));
vi.mock("@/lib/views", () => ({ withRefUrls: async (rows: unknown[]) => rows }));
vi.mock("@/lib/supabase", () => ({
  admin: () => ({
    from: (table: string) => {
      const filters: Record<string, string> = {};
      const rows = [{ id: "asset-a", view_type: "front", cutout_key: null, storage_key: "org-a/p/source.png" }];
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => { filters[key] = value; return chain; },
        order: async () => ({ data: rows }),
        maybeSingle: async () => ({ data: table === "products" && filters.organization_id === "org-a" ? { id: "p", name: "Bottle", category: "other" } : null }),
      };
      return chain;
    },
  }),
}));
import { POST } from "@/app/api/products/[id]/prepare/route";
type Invoke = (req: Request, ctx: { orgId: string; userId: string }, params: { id: string }) => Promise<unknown>;
const post = POST as unknown as Invoke;
beforeEach(() => {
  vi.clearAllMocks();
  fakes.analyze.mockResolvedValue(null);
  fakes.heroState.mockResolvedValue({ status: "original", originalUrl: "/original.jpg", cutoutUrl: null, previewUrl: null, method: null });
});
describe("upload preparation cost boundary", () => {
  it("returns the original photo without scheduling image generation", async () => {
    const result = await post(new Request("https://example.test", { method: "POST" }), { orgId: "org-a", userId: "user-a" }, { id: "p" });
    expect(result).toMatchObject({ product: { id: "p" }, hero: { status: "original", originalUrl: "/original.jpg" } });
    expect(fakes.analyze).toHaveBeenCalledWith("p");
    expect(fakes.getCutout).not.toHaveBeenCalled();
    expect(fakes.after).not.toHaveBeenCalled();
  });
  it("does not analyze another organization's product", async () => {
    await expect(post(new Request("https://example.test", { method: "POST" }), { orgId: "org-b", userId: "user-b" }, { id: "p" })).rejects.toMatchObject({ status: 404 });
    expect(fakes.analyze).not.toHaveBeenCalled();
    expect(fakes.after).not.toHaveBeenCalled();
  });
});
