import "server-only";
import type { ReviewContext } from "./generation-review";
/** Explicit render instructions use the same subject, crop and human contract as the checker. */
export function selectedShotContract(ctx: ReviewContext) {
  const recipe = ctx.recipe;
  const human = recipe?.human ?? ctx.shot?.human_presence;
  const crop = ["close","macro"].includes(ctx.shot?.framing ?? recipe?.framing ?? "full");
  const category = ctx.analysis?.category;
  const wearable = category === "jewellery" || category === "fashion";
  return [
    "FINAL SHOT CONTRACT: the customer's selected action, environment and crop override the source photo's presentation. Copy the PRODUCTS, not their old staging. A jewellery display bust, mannequin, source hand, table and room are not product components unless the actual product being sold is that object.",
    human === "model" ? (wearable ? "REQUIRED RESULT: a real-looking anonymous adult WEARING the supplied wearable product at its correct body location. Replace any display bust/mannequin with a real adult; do not retain the display support as the hero. For a necklace and earring set, show the exact necklace around the neck and both matching earrings on the ears in a natural head-and-neck portrait that makes the complete jewellery set readable. For garments/footwear, show the actual supported garment or shoes worn naturally, preserving the visible design and supplied pair count. Do not add other jewellery or invent hidden garment construction." : "REQUIRED RESULT: an anonymous adult visibly and naturally holding or using the exact product, with correct grip and scale. A product on a stand with no adult does not satisfy this shot.") : human === "hands" ? "REQUIRED RESULT: a clearly visible anatomically natural adult hand holding the actual product at believable scale. Remove the source staging and direct a new deliberate gesture; a product-only display-bust shot does not satisfy this action. For multi-piece sets, keep every supplied piece visible in the held arrangement." : "REQUIRED RESULT: product-only, with no source hands or people. A neutral support may be used only when physically needed to display a flexible product.",
    crop ? "INTENTIONAL DETAIL: focus on the real visible detail; other parts or units may be outside this crop. Do not force a full-product or complete-set layout into a macro/detail view." : "FULL PRODUCT: show all actual product components from reference 1. Count physical components consistently; a necklace plus two earrings remains that exact inventory whether sold as one set or several pieces.",
    recipe?.environment === "outdoor" ? "LOCATION: genuinely outdoors with visible open-air context and exterior light; no indoor window scene." : recipe?.environment === "studio" ? "LOCATION: seamless white studio, no decorative props; keep genuine product markings on their actual visible surface." : "",
    "All references depict the same inventory. Alternate references do not add new units. Preserve exact visible material, colour, assembly, shape and design. Never copy a source display support's writing onto the product."
  ].filter(Boolean).join("\n");
}
