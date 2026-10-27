import { requireWeb } from "@/lib/auth";
import { walletSummary, isTrialOrg } from "@/lib/credits";
import { getFlag, getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { productList, recentJobs } from "@/lib/views";
import { categoryOrOther } from "@/lib/products";
import { Studio } from "./studio";

/** The studio is the home of the app: /app and /app/new both render it. */
export async function StudioPage({ productId, denied, industry, look }: { productId?: string; denied?: boolean; industry?: string; look?: string }) {
  const ctx = await requireWeb();
  const [wallet, trial, creative, settings, { data: kits }, recent, jobs] = await Promise.all([
    walletSummary(ctx.orgId),
    isTrialOrg(ctx.orgId),
    getFlag("creative_mode", ctx.orgId),
    getSettings(),
    admin().from("brand_kits").select("id, name, palette").eq("organization_id", ctx.orgId).order("created_at"),
    productList(ctx.orgId, { limit: 12 }),
    recentJobs(ctx.orgId, 10),
  ]);
  const existing = productId ? recent.products.find((p) => p.id === productId) ?? await (async () => {
    const { data: p } = await admin().from("products").select("id,name,category,product_assets(storage_key,view_type)").eq("id", productId).eq("organization_id", ctx.orgId).is("archived_at", null).maybeSingle();
    if (!p) return null;
    const cover = p.product_assets.find((r: {view_type:string}) => r.view_type === "front") ?? p.product_assets[0];
    const { signedUrl } = await import("@/lib/storage");
    return { id:p.id, name:p.name, category:p.category, coverUrl:cover ? await signedUrl("originals",cover.storage_key,3600) : null };
  })() : null;
  const toLite = (p: {id:string;name:string;category:string;coverUrl:string|null}) => ({ id: p.id, name: p.name, category: categoryOrOther(p.category), coverUrl: p.coverUrl });
  return (
    <Studio
      key={productId ?? "new"}
      draftScope={ctx.orgId}
      locale={ctx.locale}
      balance={wallet.available}
      isTrial={trial}
      creativeEnabled={creative}
      maxImages={settings.credit_policy.maxImagesPerJob}
      brandKits={kits ?? []}
      existing={existing ? toLite(existing) : null}
      initialIndustry={industry}
      initialLook={look}
      creditsPerImage={settings.credit_policy.creditsPerImage}
      recentProducts={recent.products.filter((p) => p.photoCount > 0).map(toLite)}
      recentJobs={jobs}
      notice={denied ? "You don't have permission for that page. Ask a workspace admin." : null}
      canEdit={ctx.role !== "viewer"}
    />
  );
}
