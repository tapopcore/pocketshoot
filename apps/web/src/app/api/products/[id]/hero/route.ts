import { ApiError, handler } from "@/lib/api";
import { admin } from "@/lib/supabase";
import { heroState } from "@/lib/hero";

/** Polled by the studio while the retouched packshot is being made. */
export const GET = handler<{ id: string }>(async (_req, ctx, { id }) => {
  const { data: refs } = await admin().from("product_assets").select("id, view_type").eq("product_id", id).eq("organization_id", ctx.orgId).order("created_at");
  if (!refs?.length) throw new ApiError(404, "Product not found");
  const primary = refs.find((r) => r.view_type === "front") ?? refs[0];
  return heroState(primary.id);
});
