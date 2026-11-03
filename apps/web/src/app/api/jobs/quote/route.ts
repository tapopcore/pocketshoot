import { z } from "zod";
import { handler, ApiError, body } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { profileFits } from "@/lib/jobs";
import { categoryLook, lookEligibility, packLooks, PACK_SIZE, RECIPE_VERSION, type ShootProfile } from "@packshot/core";

const schema = z.object({ productId: z.string().uuid(), recipeId: z.string().nullish(), pack: z.enum(["studio", "variety"]).nullish(), count: z.number().int().min(1).max(20) })
  .refine((v) => !!v.recipeId !== !!v.pack, "Choose a look or a pack");

/** The exact price of a shoot before it is created. Checks the look or pack against the product's photos. */
export const POST = handler(async (req, ctx) => {
  const input = await body(req, schema);
  const { data: p } = await admin().from("products").select("category,attributes").eq("id", input.productId).eq("organization_id", ctx.orgId).is("archived_at", null).maybeSingle();
  if (!p) throw new ApiError(404, "Product not found");
  const profile = (p.attributes as { shootProfile?: ShootProfile } | null)?.shootProfile;
  if (!profile || !profileFits(profile, p.category)) throw new ApiError(400, "Confirm this product first.");
  const { data: refs } = await admin().from("product_assets").select("view_type").eq("product_id", input.productId);
  const policy = (await getSettings()).credit_policy;
  if (input.pack) {
    const looks = packLooks(input.pack, profile, refs ?? []);
    if (input.count !== PACK_SIZE || looks.length !== PACK_SIZE) throw new ApiError(400, `A pack is ${PACK_SIZE} photos.`);
    return { credits: PACK_SIZE * policy.creditsPerImage, recipeVersion: RECIPE_VERSION, looks: looks.map((l) => ({ id: l.id, title: l.title })) };
  }
  const look = categoryLook(input.recipeId!);
  if (!look) throw new ApiError(400, "Choose a look for this product.");
  const issue = lookEligibility(look, profile, refs ?? []);
  if (issue) throw new ApiError(400, issue, "reference_required");
  if (input.count > policy.maxImagesPerJob) throw new ApiError(400, "Reduce the number of images.");
  return { credits: input.count * policy.creditsPerImage, recipeVersion: RECIPE_VERSION };
});
