import { requireWeb } from "@/lib/auth";
import { getWallet, isTrialOrg } from "@/lib/credits";
import { getFlag, getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { productList } from "@/lib/views";
import { categoryOrOther } from "@/lib/products";
import { Studio } from "./studio";
import { getScenePreviews } from "@/lib/scene-previews";

export const metadata = { title: "New photoshoot" };

export default async function NewShoot({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const ctx = await requireWeb("editor");
  const sp = await searchParams;
  const [wallet, trial, creative, settings, { data: kits }, recent, previews] = await Promise.all([
    getWallet(ctx.orgId),
    isTrialOrg(ctx.orgId),
    getFlag("creative_mode", ctx.orgId),
    getSettings(),
    admin().from("brand_kits").select("id, name, palette").eq("organization_id", ctx.orgId).order("created_at"),
    productList(ctx.orgId, { limit: 12 }),
    getScenePreviews(),
  ]);
  const existing = sp.product ? recent.products.find((p) => p.id === sp.product) ?? (await productList(ctx.orgId, { limit: 200 })).products.find((p) => p.id === sp.product) : null;
  const toLite = (p: (typeof recent.products)[number]) => ({ id: p.id, name: p.name, category: categoryOrOther(p.category), coverUrl: p.coverUrl });
  return (
    <Studio
      key={sp.product ?? "new"}
      locale={ctx.locale}
      balance={wallet.available}
      isTrial={trial && settings.credit_policy.trialWatermark}
      creativeEnabled={creative}
      maxImages={settings.credit_policy.maxImagesPerJob}
      brandKits={kits ?? []}
      existing={existing ? toLite(existing) : null}
      previews={previews}
      recentProducts={recent.products.filter((p) => p.photoCount > 0).map(toLite)}
    />
  );
}
