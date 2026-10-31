import type { CategoryId } from "./categories";
import type { ProductAnalysis } from "./director";

/** Photographic principles distilled from the Indian-market research, not campaign replicas. */
const DISCIPLINES: Record<CategoryId, string> = {
  beauty: "Distinguish skincare, colour cosmetics, haircare and worn nail products before directing. Show the observed finish, shade and application area. Use credible Indian skin tones and real skin texture for human shots. Ingredient props require readable evidence; no invented efficacy, drips, swatches or formula colours. Worn nails remain worn nails, never a blister pack. Build the palette from the pack and product, rather than generic botanical spa decoration.",
  fashion: "Identify the actual garment type: saree, suit, lehenga, western womenswear or menswear. Preserve panel construction, motif positions and scale, border width, pallu, weave, opacity, neckline, sleeves, seams and included pieces. Direct a useful stance or natural gesture that reveals the garment; keep hem and design readable. Indian settings and occasions must fit the brief, not default wedding props. Do not invent a stitched blouse from unstitched fabric, hidden back construction or an additional garment. For footwear, preserve sole, toe box, lace path, panel seams and pair count; use contemporary on-foot styling and material detail only with supporting references.",
  jewellery: "Distinguish everyday, occasion and bridal pieces. Preserve the exact stone count, cut, settings, fastening, links, pair count and metal tone. Use a credible body location, wearable scale, natural Indian skin and real contact; nothing fused into skin. Bridal atmosphere is not appropriate for every jewel. Create purpose through light on the actual metal and stone rather than adding generic velvet, flowers or festive props.",
  food: "Identify the actual dish, ingredient or packaged food and its regional preparation only when supported. Preserve portion, shape, texture, garnish and packaging. Create appetite through real side light, believable moisture and a useful serving moment; no fake plastic gloss. Steam only for a plausibly hot dish, never invent fillings or ingredients. Indian tableware and settings should match the dish and buyer context, not a stock festive spread.",
  home_kitchen: "Show scale, material and intended utility: a vessel is not jewellery, a closure is not a bracelet, and a fabric item is not a jar. Preserve all supplied colour variants and assembly. For household action, ensure grip, load, openings and contact are mechanically possible. Build a lived-in but edited Indian home context only when appropriate. Avoid the same linen, window and foliage scene for unrelated products.",
  electronics: "Preserve ports, buttons, screen geometry, connections, controls and assembly. Show practical use only when the device and action are understood. Never invent a screen interface, compatible device, hidden port or cable route. Use precise motivated reflections and plausible scale, with a materially appropriate contemporary workspace rather than generic sci-fi neon.",
  other: "Determine product function and source form first. If uncertain, choose a restrained material-led product photograph and ask for clarification rather than inventing use. Preserve unit count, assembly, printed design and observed construction. Build the set from the actual shape, colour or function rather than assigning a stock luxury background."
};

export function categoryArtDirection(category: CategoryId): string {
  return DISCIPLINES[category];
}

/** One text direction call plans the set; no preview image calls or additional model passes. */
export function campaignPlan(count: number): string {
  const roles = [
    "Signature hero: establish one original visual idea grounded in a visible product truth.",
    "Alternative composition: change camera height, depth and placement meaningfully, not just rotate the previous frame.",
    "Material study: reveal an observed texture or construction detail with a closer optical viewpoint.",
    "Editorial context: change scale relationship and negative space within the chosen environment and human constraints.",
    "Purposeful moment: a different useful gesture when people are selected; otherwise a physically grounded arrangement showing function or form.",
    "Campaign closer: a distinct light direction and graphic composition, preserving the same product and world."
  ];
  return Array.from({ length: count }, (_, n) => "Shot " + (n + 1) + ": " + roles[n % roles.length]).join("\n");
}

export function photographicContract(analysis: ProductAnalysis | null): string {
  return [
    "PHOTOGRAPHIC CONTRACT: make an authored, believable commercial photograph, not a cutout pasted into a background. Relight the exact product with the set; use physically plausible reflections, weight, contact shadows, optical depth and natural material microtexture. Avoid plastic skin, waxy food, uniform CGI gloss, fake blur halos and decorative clutter.",
    "PRODUCT TRUTH: image 1 defines unit count, colour variants and assembly. Later photos show those SAME units, never additional inventory. Preserve the source form: worn, loose, packaged and assembled products are different. Never add a spare cap, detach a closed part, invent hidden construction or replace an unbranded surface with a logo.",
    analysis?.subject_count ? "REFERENCE INVENTORY: " + analysis.subject_count + " product unit(s) in image 1; retain these in full-product frames." : "Count product units in reference image 1, excluding hands, shadows and props.",
    "FACE-AWARE PRINT: preserve marks on the physical surface where observed. Do not project front text onto an unprinted side, sole or back. Intentionally hidden or cropped text is not missing text. Do not fabricate unreadable small lettering.",
    categoryArtDirection(analysis?.category ?? "other"),
    "CULTURAL CONTEXT: contemporary Indian people and places when relevant to the brief; no automatic palace, marigold, brass, wedding or exotic heritage treatment. Never reproduce a named brand campaign, copyrighted artwork, endorsement or identifiable person's likeness.",
    "STYLE IS A CONSTRAINT, NOT A BACKGROUND TEMPLATE: honor the selected environment, framing and human presence. Outdoor means genuinely outside under open sky; a room beside a sunny window is indoor. A human action must be mechanically credible. A studio frame remains product-only if selected. Product facts and requested action outrank decorative props."
  ].join("\n");
}
