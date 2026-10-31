import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Studio, type Step } from "@/app/app/new/studio";

const FIXTURE = {
  product: { id: "p1", name: "Peach iced tea drink", category: "food" as const },
  analysis: {
    name: "Peach iced tea", brand: "Leaf & Co", category: "food" as const, description: "Clear glass bottle with a peach label and a gold cap.", materials: ["Glass bottle", "Metal cap"], colours: ["#E89A4E", "#F3EEE4", "#D9443A"],
    visible_text: ["Peach Iced Tea", "330 ml"], size: "small" as const, orientation: "standing" as const, viewpoint: "front" as const, key_ingredients: ["Peach"], suggested_scenes: [], ideas: [], photo_issues: ["Slight glare on the label"], label_legibility: 0.9,
  },
  ideas: [], suggestedScenes: [],
  hero: { status: "ready", originalUrl: "/showcase/beverage-before.webp", cutoutUrl: null, previewUrl: null, method: null },
  references: [{ id: "r1", view_type: "front", url: "/showcase/beverage-before.webp" }, { id: "r2", view_type: "back", url: "/showcase/beverage-0.webp" }, { id: "r3", view_type: "detail", url: "/showcase/beverage-3.webp" }],
  suggestions: [
    { id: "props-fresh-peach-slices", kind: "props" as const, title: "Fresh peach slices", text: "Scatter a few fresh peach slices around the bottle to echo the fruit on the label." },
    { id: "setting-sunny-cafe-table", kind: "setting" as const, title: "Sunny café table", text: "Place it on a light wooden café table by a window with warm afternoon sun." },
    { id: "detail-cold-droplets", kind: "detail" as const, title: "Cold droplets on the glass", text: "Show cold water droplets on the glass so the drink looks chilled and fresh." },
    { id: "angle-low-hero-angle", kind: "angle" as const, title: "Low hero angle", text: "Shoot from just below the label so the bottle looks tall and confident." },
    { id: "mood-bright-summer", kind: "mood" as const, title: "Bright summer feel", text: "Keep colours bright and warm, like a clear summer afternoon." },
    { id: "human-hand-lifting-it", kind: "human" as const, title: "Hand lifting it", text: "An adult hand lifts the bottle off the table, label facing the camera." },
  ],
};

/** UI preview harness for local screenshots. Disabled unless PREVIEW_UI=1. */
const UNKNOWN = {
  ...FIXTURE,
  product: { id: "p2", name: "Plastic cap with carry handle", category: "other" as const },
  analysis: { ...FIXTURE.analysis, name: "Plastic cap with carry handle", brand: null, category: "other" as const, description: "Two ribbed plastic caps with a flat carry handle.", materials: ["Plastic"], visible_text: [], photo_issues: [] },
  hero: { ...FIXTURE.hero, originalUrl: "/showcase/bottle-before.webp" },
  references: [{ id: "r1", view_type: "front", url: "/showcase/bottle-before.webp" }],
  suggestions: FIXTURE.suggestions.slice(0, 4),
};

const LEHENGA = {
  ...FIXTURE,
  product: { id: "p3", name: "Mint embroidered lehenga set", category: "fashion" as const },
  analysis: { ...FIXTURE.analysis, name: "Mint embroidered lehenga set", brand: null, category: "fashion" as const, description: "Mint lehenga with gold embroidery.", materials: ["embroidered fabric", "metallic thread/embellishments", "net dupatta"], colours: ["#A8E6CF", "#C9A54C", "#CDEBF2", "#B07A3A"], visible_text: [], size: "medium" as const, photo_issues: ["Busy background"] },
  hero: { ...FIXTURE.hero, originalUrl: "/showcase/lehenga-before.webp" },
  references: [{ id: "r1", view_type: "front", url: "/showcase/lehenga-before.webp" }],
};

export default async function DevStudio({ searchParams }: { searchParams: Promise<{ step?: string; fx?: string; mode?: string }> }) {
  if (process.env.PREVIEW_UI !== "1") notFound();
  const { step, fx, mode } = await searchParams;
  const s = (["product", "looks", "review"].includes(step ?? "") ? step : undefined) as Step | undefined;
  return (
    <AppShell locale="en" orgName="Demo workspace" orgs={[]} orgId="x" credits={12} email="demo@example.com" isPlatform={false}>
      <Studio locale="en" balance={12} isTrial={false} creativeEnabled maxImages={8} brandKits={[]} existing={null}
        fixture={step ? (fx === "unknown" ? UNKNOWN : fx === "lehenga" ? LEHENGA : FIXTURE) : undefined} previewStep={s} previewMode={mode === "one" || mode === "studio" || mode === "variety" ? mode : undefined} previewLook={s && s !== "product" && mode === "one" ? (fx === "unknown" ? "general-2" : "beverage-2") : undefined}
        recentProducts={[{ id: "p1", name: "Body lotion", category: "beauty", coverUrl: "/showcase/skincare-before.webp" }, { id: "p2", name: "Leather tote", category: "fashion", coverUrl: "/showcase/bags-before.webp" }]}
        recentJobs={[]} bulkEnabled />
    </AppShell>
  );
}
