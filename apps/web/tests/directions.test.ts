import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/products/[id]/directions/route";

describe("retired concept preview endpoint", () => {
  it.each([["GET", GET], ["POST", POST]] as const)("blocks %s, including requests from old tabs", async (_method, handler) => {
    const response = handler();
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ state: "disabled", urls: [] });
  });
});
