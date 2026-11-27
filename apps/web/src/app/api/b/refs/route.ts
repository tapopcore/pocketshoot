import { handler, ApiError } from "@/lib/api";
import { BabyError, saveRef } from "@/lib/baby/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Add one photo of the baby. */
export const POST = handler(async (req, ctx) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || !file.size) throw new ApiError(400, "Add a photo first.");
  try { return await saveRef(ctx.orgId, file); }
  catch (e) { if (e instanceof BabyError) throw new ApiError(e.status, e.message, e.code); throw e; }
});
