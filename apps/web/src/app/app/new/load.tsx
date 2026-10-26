import { clientIp, requireWeb } from "@/lib/auth";
import { getWallet, grantTrialIfEligible, isTrialOrg } from "@/lib/credits";
import { getFlag, getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { productList, recentJobs } from "@/lib/views";
import { categoryOrOther } from "@/lib/products";
import { getScenePreviews } from "@/lib/scene-previews";
import { Studio } from "./studio";

/** The studio is the home of the app: /app and /app/new both render it. */
export async function StudioPage({ productId, denied }: { productId?: string; denied?: boolean }) {
  const ctx = await requireWeb();
  const granted = await grantTrialIfEligible(ctx, await clientIp());
  const [wallet, trial, creative, settings, { data: kits }, recent, jobs, previews] = await Promise.all([
    getWallet(ctx.orgId),
    isTrialOrg(ctx.orgId),
    getFlag("creative_mode", ctx.orgId),
    getSettings(),
    admin().from("brand_kits").select("id, name, palette").eq("organization_id", ctx.orgId).order("created_at"),
    productList(ctx.orgId, { limit: 12 }),
    recentJobs(ctx.orgId, 10),
    getScenePreviews(),
  ]);
  const existing = productId ? recent.products.find((p) => p.id === productId) ?? (await productList(ctx.orgId, { limit: 200 })).products.find((p) => p.id === productId) : null;
  const toLite = (p: (typeof recent.products)[number]) => ({ id: p.id, name: p.name, category: categoryOrOther(p.category), coverUrl: p.coverUrl });
  return (
    <Studio
      key={productId ?? "new"}
      locale={ctx.locale}
      balance={wallet.available}
      isTrial={trial && settings.credit_policy.trialWatermark}
      creativeEnabled={creative}
      maxImages={settings.credit_policy.maxImagesPerJob}
      brandKits={kits ?? []}
      existing={existing ? toLite(existing) : null}
      previews={previews}
      recentProducts={recent.products.filter((p) => p.photoCount > 0).map(toLite)}
      recentJobs={jobs}
      notice={denied ? "You don't have permission for that page. Ask a workspace admin." : granted > 0 ? `Welcome! ${granted} free credits are in your account. Drop a product photo to start.` : null}
      canEdit={ctx.role !== "viewer"}
    />
  );
}
