import { handler } from "@/lib/api";
import { deleteBabyData } from "@/lib/baby/service";
import { admin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Delete my account: erases photos, shoots and details, then the sign-in itself. Paid invoices stay for tax records. */
export const DELETE = handler(async (req, ctx) => {
  await deleteBabyData(ctx.orgId);
  if (ctx.userId) await admin().auth.admin.deleteUser(ctx.userId, true);
  return { ok: true };
});
