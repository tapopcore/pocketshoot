import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ attrs: {} as Record<string, unknown>, org: "org-a", rateError: false, rateAllowed: true }));
const fakes = vi.hoisted(() => ({ after: vi.fn(), edit: vi.fn(), update: vi.fn(), rpc: vi.fn(), signedUrls: vi.fn(), getObject: vi.fn(), putObject: vi.fn(), getSettings: vi.fn() }));
vi.mock("next/server", () => ({ after: fakes.after }));
vi.mock("@/lib/api", () => ({ handler: (fn: unknown) => fn, ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock("@/lib/auth", () => ({ assertRole: vi.fn() }));
vi.mock("@/lib/env", () => ({ integrations: { openai: true } }));
vi.mock("@/lib/settings", () => ({ getSettings: fakes.getSettings }));
vi.mock("@/lib/providers", () => ({ getProvider: () => ({ edit: fakes.edit }) }));
vi.mock("@/lib/observe", () => ({ logError: vi.fn() }));
vi.mock("@/lib/storage", () => ({ signedUrls: fakes.signedUrls, getObject: fakes.getObject, putObject: fakes.putObject }));
vi.mock("@/lib/supabase", () => ({
  admin: () => ({
    rpc: fakes.rpc,
    from: (table: string) => {
      const filters: Record<string, string> = {};
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => { filters[key] = value; return chain; },
        order: () => chain,
        insert: async () => ({ error: null }),
        update: (value: { attributes?: Record<string, unknown> }) => { fakes.update(value); if (value.attributes) state.attrs = value.attributes; return chain; },
        maybeSingle: async () => ({ data: table === "products" && filters.organization_id === state.org ? { id: "p", attributes: state.attrs } : null }),
        limit: async () => ({ data: [{ storage_key: "org-a/p/source.png" }] }),
        then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
      };
      return chain;
    },
  }),
}));
import sharp from "sharp";
import { GET, POST } from "@/app/api/products/[id]/directions/route";
type Invoke = (req: Request, ctx: { orgId: string; userId: string }, params: { id: string }) => Promise<unknown>;
const get = GET as unknown as Invoke;
const post = POST as unknown as Invoke;
const ctx = { orgId: "org-a", userId: "user-a" };
beforeEach(() => {
  vi.clearAllMocks();
  state.org = "org-a";
  state.attrs = { analysis: { ideas: [{ title: "Light", description: "Amber light on stone.", human_presence: "none" }] } };
  fakes.rpc.mockResolvedValue({ data: false, error: { message: "unavailable" } });
});
describe("private concept preview boundary", () => {
  it("does not read another organization's product", async () => {
    await expect(get(new Request("https://example.test"), { ...ctx, orgId: "org-b" }, { id: "p" })).rejects.toMatchObject({ status: 404 });
    expect(fakes.edit).not.toHaveBeenCalled();
    expect(fakes.signedUrls).not.toHaveBeenCalled();
  });
  it("fails closed before scheduling paid work when the rate limiter fails", async () => {
    await expect(post(new Request("https://example.test", { method: "POST" }), ctx, { id: "p" })).rejects.toMatchObject({ status: 429 });
    expect(fakes.after).not.toHaveBeenCalled();
    expect(fakes.edit).not.toHaveBeenCalled();
    expect(fakes.update).not.toHaveBeenCalled();
  });
  it("returns an unavailable state for a product without creative ideas", async () => {
    state.attrs = {};
    await expect(post(new Request("https://example.test", { method: "POST" }), ctx, { id: "p" })).resolves.toEqual({ state: "unavailable", urls: [] });
    expect(fakes.rpc).not.toHaveBeenCalled();
    expect(fakes.after).not.toHaveBeenCalled();
  });
  it("stores generated previews in a MIME type allowed by the private originals bucket", async () => {
    fakes.rpc.mockResolvedValue({ data: true, error: null });
    const png = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#b26b37" } }).png().toBuffer();
    fakes.getObject.mockResolvedValue(png);
    fakes.edit.mockResolvedValue({ image: png, model: "test", costUsd: 0 });
    fakes.getSettings.mockResolvedValue({ providers: { openai: { model: "test" } } });
    await post(new Request("https://example.test", { method: "POST" }), ctx, { id: "p" });
    await fakes.after.mock.calls[0][0]();
    expect(fakes.putObject).toHaveBeenCalledTimes(1);
    const [bucket, key, image, mime] = fakes.putObject.mock.calls[0];
    expect(bucket).toBe("originals");
    expect(key).toMatch(/^org-a\/p\/directions\/.+\.jpg$/);
    expect(mime).toBe("image/jpeg");
    expect((await sharp(image).metadata()).format).toBe("jpeg");
    expect((state.attrs.creative_preview as { state: string }).state).toBe("ready");
  });
  it("schedules one background preview request after both limits pass", async () => {
    fakes.rpc.mockResolvedValue({ data: true, error: null });
    await expect(post(new Request("https://example.test", { method: "POST" }), ctx, { id: "p" })).resolves.toMatchObject({ state: "pending", urls: [] });
    expect(fakes.rpc).toHaveBeenCalledTimes(2);
    expect(fakes.after).toHaveBeenCalledTimes(1);
    expect(fakes.edit).not.toHaveBeenCalled();
  });
});
