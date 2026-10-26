import { handler } from "@/lib/api";
import { clientIp } from "@/lib/auth";
import { getWallet, grantTrialIfEligible } from "@/lib/credits";
import { getFlag, getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { CATEGORY_LIST, OUTPUT_LIST, STYLE_LIST } from "@packshot/core";

/** Session bootstrap for the mobile app and Shopify app. */
export const GET = handler(async (_req, ctx) => {
  if (ctx.via !== "shopify") await grantTrialIfEligible(ctx, await clientIp());
  const [wallet, settings, creative, orgs] = await Promise.all([
    getWallet(ctx.orgId),
    getSettings(),
    getFlag("creative_mode", ctx.orgId),
    ctx.userId ? admin().from("memberships").select("role, organizations(id, name)").eq("user_id", ctx.userId) : Promise.resolve({ data: [] }),
  ]);
  return {
    user: ctx.userId ? { id: ctx.userId, email: ctx.email, locale: ctx.locale } : null,
    org: { id: ctx.orgId, name: ctx.orgName, role: ctx.role },
    orgs: (orgs.data ?? []).map((m) => ({ ...(m as unknown as { organizations: { id: string; name: string } }).organizations, role: (m as { role: string }).role })),
    via: ctx.via,
    wallet: { available: wallet.available, reserved: wallet.reserved, consumed: wallet.consumed },
    policy: settings.credit_policy,
    features: { creativeMode: creative },
    catalog: {
      categories: CATEGORY_LIST.map(({ id, label, labelHi, short, difficulty, caution, defaultLocks, recommendedPresets }) => ({ id, label, labelHi, short, difficulty, caution, defaultLocks, recommendedPresets })),
      styles: STYLE_LIST.map(({ id, name, nameHi, description, swatch }) => ({ id, name, nameHi, description, swatch })),
      outputs: OUTPUT_LIST.map(({ id, name, ratio, width, height, hint }) => ({ id, name, ratio, width, height, hint })),
    },
  };
});
