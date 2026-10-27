import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Studio } from "@/app/app/new/studio";
import type { ProductAnalysis } from "@packshot/core";

export default function CreativePreview() {
  if (process.env.PREVIEW_UI !== "1") notFound();
  const analysis: ProductAnalysis = {
    name: "Amber facial serum", brand: null, category: "beauty", description: "Amber glass dropper bottle with a cream paper label.",
    materials: ["glass", "paper"], colours: ["#9c592c", "#e8dfc8"], visible_text: [], size: "small", orientation: "standing", viewpoint: "front",
    key_ingredients: [], suggested_scenes: ["neutral_studio", "bathroom_shelf"], photo_issues: [], label_legibility: 1,
    use_case: "A facial serum in a glass dropper bottle.", usage_confidence: "observed",
    visual_strategy: "Make the warm amber glass the signature, then connect it to a quiet daily ritual.",
    ideas: [
      { title: "Light through amber", description: "Hard morning light passes through the bottle, casting a warm amber reflection across deep green stone.", base_scene: "neutral_studio", purpose: "hero", human_presence: "none", why: "A distinct campaign image built around the actual glass." },
      { title: "The morning ritual", description: "An adult holds the bottle beside a window. Natural skin, soft linen and a believable everyday gesture.", base_scene: "bathroom_shelf", purpose: "human", human_presence: "model", why: "Shows scale and gives the product a human context." },
      { title: "Glass meets linen", description: "A close study of paper, amber glass and a suspended droplet in raking window light.", base_scene: "neutral_studio", purpose: "detail", human_presence: "none", why: "Makes the materials and texture feel tangible." },
    ],
  };
  return <AppShell locale="en" orgName="Preview workspace" orgs={[]} orgId="preview" credits={12} email="preview@example.com" isPlatform={false}>
    <p className="mb-5 rounded-xl border border-line p-3 text-sm">Design preview with AI-created example photography. Upload and billing are not connected here.</p>
    <Studio locale="en" balance={12} isTrial={false} creativeEnabled maxImages={8} brandKits={[]} existing={null} recentProducts={[]} recentJobs={[]}
      fixture={{ product: { id: "preview", name: analysis.name, category: "beauty" }, analysis, ideas: analysis.ideas, suggestedScenes: ["neutral_studio"], hero: { status: "ready", originalUrl: "/directions/hero.webp", previewUrl: "/directions/hero.webp", cutoutUrl: "/directions/hero.webp", method: "example" } }} />
  </AppShell>;
}
