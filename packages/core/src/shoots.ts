import type { CategoryId } from "./categories";
import type { StyleId } from "./presets";
import type { HumanPresence } from "./director";

export const SHOOT_STYLE_IDS = ["indoor", "outdoor", "model", "closeup", "macro", "graphic"] as const;
export type ShootStyleId = typeof SHOOT_STYLE_IDS[number];
export type Framing = "full" | "close" | "macro";
export interface ShootStyle {
  id: ShootStyleId; title: string; subtitle: string; image: string;
  scene: StyleId; framing: Framing; human: HumanPresence; brief: string;
}
export const SHOOT_STYLES: Record<ShootStyleId, ShootStyle> = {
  indoor: { id: "indoor", title: "Indoor", subtitle: "Window light. Quiet interiors.", image: "/catalog/indoor.webp", scene: "shadow_play", framing: "full", human: "none",
    brief: "An editorial interior still life. Build a real architectural set around the product's observed materials: directional window light, tactile surfaces, grounded shadows. One deliberate composition, no generic podium or irrelevant props." },
  outdoor: { id: "outdoor", title: "Outdoor", subtitle: "Open air. Natural drama.", image: "/catalog/outdoor.webp", scene: "outdoor_location", framing: "full", human: "none",
    brief: "An outdoor campaign photograph with a location chosen for the product. Real daylight, believable weather and scale, tactile ground and atmospheric depth. Keep it physically supported; no invented waterproofing, exposure to damage or floating objects." },
  model: { id: "model", title: "With a model", subtitle: "Real gestures. Human connection.", image: "/catalog/model.webp", scene: "natural_sunlight", framing: "full", human: "model",
    brief: "An anonymous adult in a candid editorial moment with the product. Choose a useful, natural pose suited to its confirmed use. Correct scale, grip, contact shadows, real skin and fabric. Keep the product prominent; use a neutral holding pose if use is uncertain." },
  closeup: { id: "closeup", title: "Close-up", subtitle: "Craft you can almost feel.", image: "/catalog/closeup.webp", scene: "neutral_studio", framing: "close", human: "none",
    brief: "A tight editorial close-up of one distinctive visible construction detail. Crop intentionally, retain recognisable product context and exact materials, stitching or finish. Raking light reveals genuine texture; never invent hidden parts or extra ornament." },
  macro: { id: "macro", title: "Macro", subtitle: "The smallest details, in focus.", image: "/catalog/macro.webp", scene: "neutral_studio", framing: "macro", human: "none",
    brief: "A true macro photograph of a visible material or craft detail. Choose the focus plane deliberately; retain a sharp identity-bearing feature and plausible optical falloff. Render real surface texture and coherent reflections. Do not invent internal structure." },
  graphic: { id: "graphic", title: "Graphic campaign", subtitle: "Bold sets. A clear visual idea.", image: "/catalog/graphic.webp", scene: "colour_pop", framing: "full", human: "none",
    brief: "A graphic campaign built as a physical paper and colour-block set. One strong geometric composition, motivated hard light, real shadows and negative space for later copy. Photograph the actual product; no text overlays, invented logos or synthetic 3D finish." },
};
export function shootRecipe(id: ShootStyleId, category: CategoryId) {
  const look = SHOOT_STYLES[id];
  const modelAction: Partial<Record<CategoryId, string>> = {
    fashion: "Wear only when the source establishes the wearable shape and fit; otherwise hold it.",
    jewellery: "Wear only the visible type of jewellery, with anatomically correct attachment and no altered stone count.",
    food: "Hold the closed package naturally; do not invent serving contents or consumption claims.",
    electronics: "Hold or use only visibly established controls; no invented screens, ports or compatibility.",
    beauty: "Hold the closed product near the face or hands; no unconfirmed application, skin effects or efficacy claims.",
    home_kitchen: "Use a natural adult hand or nearby adult to establish scale, with credible reach and weight.",
  };
  return { ...look, brief: look.brief + (id === "model" ? " " + (modelAction[category] || "Use a neutral holding pose; do not infer a function.") : "") };
}

/** Customer selection is an invariant, not a suggestion inferred from the generated brief. */
export function styleRequirement(id: ShootStyleId): string {
  const rules: Record<ShootStyleId,string> = {
    outdoor: "MUST be outdoors in open air with clear exterior landscape or sky context. No room, window-side tabletop, interior counter, studio wall or window-frame shadows. Keep the product dry unless the reference establishes safe wet use.",
    indoor: "MUST be an interior or studio photograph, either an intentional indoor setting or a seamless studio backdrop, not an outdoor landscape.",
    model: "MUST visibly include an anonymous adult interacting naturally with the product. A product-only still life does not satisfy this style.",
    closeup: "MUST be a tight close-up of a genuinely visible product detail, with recognisable product context; not a distant whole-product still life.",
    macro: "MUST be a highly magnified material or craft detail with a deliberate macro focus plane; not a whole-product catalogue shot.",
    graphic: "MUST show a deliberate physical geometric or colour-block campaign composition; not a generic lifestyle tabletop. No generated text overlays.",
  };
  return rules[id];
}
export function shotMatchesStyle(id: ShootStyleId, shot: { scene: string; lighting: string }): boolean {
  if (id !== "outdoor") return true;
  return !/\b(indoors?|interior|windows?|window[- ]pane|countertop|bedroom|bathroom|living room|linen[- ]draped)\b/i.test(shot.scene + " " + shot.lighting);
}
export interface StyleReview { style_match?: boolean; environment?: string; human_visible?: boolean; framing_match?: boolean }
export function passesStyleReview(id: ShootStyleId, review: StyleReview): boolean {
  if (review.style_match !== true || review.framing_match !== true) return false;
  if (id === "outdoor" && review.environment !== "outdoor") return false;
  if (id === "indoor" && review.environment !== "indoor" && review.environment !== "studio") return false;
  if (id === "model" && review.human_visible !== true) return false;
  return true;
}
