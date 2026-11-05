/**
 * Contract fixtures (Phase 1, checklist A09, B10). Built from the recorded incidents and the pack's
 * named difficult cases. They describe evidence and intent only: no image is generated from them.
 * Asset IDs are synthetic; production IDs are referenced in comments for traceability.
 */
import { CONTRACT_VERSION, untrusted } from "./common";
import type { ComponentConfiguration, Entity, Fact, Lock, ProductEvidence, SourceAsset, TransformationPermission } from "./product-evidence";
import { confirmGoal, type ShootGoal, type ShootGoalDraft } from "./shoot-goal";
import type { ShotPlan, ShotSlot } from "./shot-plan";
import { summarise, type JobResultDTO, type ProductSummaryDTO, type QuoteDTO } from "./dto";
import { presentFailure } from "./settlement";

const src = (assetId: string, viewRole: SourceAsset["viewRole"], w = 2304, h = 3072): SourceAsset => ({ assetId, storageKey: `fixtures/${assetId}.jpg`, checksum: "sha256:" + assetId, viewRole, width: w, height: h, uploadRevision: 1 });
const ok = (t: TransformationPermission["transformation"]): TransformationPermission => ({ transformation: t, status: "supported", reason: "" });

function evidence(p: Partial<ProductEvidence> & Pick<ProductEvidence, "productId" | "sources" | "identity" | "entities">): ProductEvidence {
  return { schemaVersion: CONTRACT_VERSION, evidenceRevision: 1, facts: [], configurations: [], locks: [], transformations: [ok("reposition"), ok("place_in_scene")], unknowns: [], analysis: { model: "fixture", promptVersion: "fixture-1", analysedAt: "2026-11-05T00:00:00Z" }, ...p };
}

const draft = (d: Partial<ShootGoalDraft> & Pick<ShootGoalDraft, "productId" | "offering" | "family" | "quantity">): ShootGoalDraft => ({ evidenceRevision: 1, usage: "marketplace", aspectRatio: "4:5", creativeLatitude: "medium", intent: "first_shoot", selectedAdditions: [], approvedAlternatives: [], ...d });
export const goal = (d: Parameters<typeof draft>[0]): ShootGoal => confirmGoal(draft(d), "goal-" + d.productId, "2026-11-05T00:00:00Z");

const slot = (index: number, s: Partial<ShotSlot> & Pick<ShotSlot, "view" | "humanAction" | "distinction">): ShotSlot => ({
  slotId: "s" + index, index, purpose: "hero", framing: "full", subject: { referenceForm: "object", componentStates: [] }, environment: "white_studio",
  location: "seamless studio", set: "none", lighting: "soft key", productProminence: "dominant", props: [], entityIds: ["product"], referenceAssetIds: ["a-front"], requirements: [], transformations: [], ...s,
});
const plan = (g: ShootGoal, e: ProductEvidence, slots: ShotSlot[], extra: Partial<ShotPlan> = {}): ShotPlan => ({ schemaVersion: CONTRACT_VERSION, planId: "plan-" + e.productId, revision: 1, goalFingerprint: g.fingerprint, evidenceRevision: e.evidenceRevision, idea: "fixture idea", slots, status: "feasible", missing: [], historyFingerprints: [], ...extra });

/* ------------------------------------------------------------------ */
/* BONKERS: folded cream tee among clutter (production job bf60f737). */

export const bonkersEvidence = evidence({
  productId: "bonkers-tee",
  sources: [src("a-front", "front")],
  identity: { category: "fashion", collection: "mens-modern", construction: "stitched", referenceForm: "folded", materials: ["cotton knit"], colours: ["cream"], shape: "crew-neck short-sleeve T-shirt" },
  entities: [
    { entityId: "product", role: "merchandise", label: "Cream crew-neck T-shirt", quantity: 1, sourceAssetIds: ["a-front"] },
    { entityId: "hang-tag", role: "removable_tag", label: "Red retail hang tag", sourceAssetIds: ["a-front"], partOf: "product", keepInPhotos: false },
    { entityId: "green-garment", role: "background", label: "Green garment beside the tee", sourceAssetIds: ["a-front"] },
    { entityId: "tissue", role: "background", label: "Branded tissue paper", sourceAssetIds: ["a-front"] },
    { entityId: "bedding", role: "background", label: "Blue bedding", sourceAssetIds: ["a-front"] },
  ],
  facts: [
    { factId: "f-brand", kind: "text", statement: "Neck label reads BONKERS", sourceAssetIds: ["a-front"], certainty: "high", provenance: "readable" },
    { factId: "f-colour", kind: "colour", statement: "Light cream body", sourceAssetIds: ["a-front"], certainty: "high", provenance: "visible" },
  ],
  locks: [
    { kind: "colour", detail: "Light cream shade", sourceAssetIds: ["a-front"] },
    { kind: "label", detail: "Black BONKERS neck label", sourceAssetIds: ["a-front"] },
    { kind: "silhouette", detail: "Crew neck, short sleeves", sourceAssetIds: ["a-front"] },
  ],
  transformations: [ok("reposition"), ok("place_in_scene"), ok("unfold"), ok("wear"), ok("remove_tag"), { transformation: "hold", status: "supported", reason: "" }],
  unknowns: ["Back of the shirt is not shown", "Exact fit and length cannot be measured from a folded photo"],
});

export const bonkersModelGoal = goal({ productId: "bonkers-tee", offering: "model_use", family: "model_worn", quantity: 6, usage: "website" });

const worn = (i: number, view: ShotSlot["view"], location: string, distinction: string, extra: Partial<ShotSlot> = {}) =>
  slot(i, { view, humanAction: "model_wearing", purpose: "worn", environment: "neutral_studio", location, subject: { referenceForm: "worn", componentStates: [] }, transformations: ["wear"], distinction, ...extra });

/** Six distinct model-worn photographs, front evidence only, no back view, tag removed. */
const tagOff: Partial<ShotSlot> = { transformations: ["wear", "remove_tag"] };
export const bonkersValidPlan = plan(bonkersModelGoal, bonkersEvidence, [
  worn(0, "full_body", "warm beige seamless", "Standing front, full length, shows fit and trouser pairing", tagOff),
  worn(1, "half_body", "warm beige seamless", "Waist-up front, hands in pockets, collar and logo readable", tagOff),
  worn(2, "full_body", "concrete gallery corridor", "Mid-stride walk, fabric movement", { ...tagOff, environment: "indoor" }),
  worn(3, "body_crop", "warm beige seamless", "Chest crop on the BONKERS mark and neckline", { ...tagOff, framing: "close", purpose: "detail" }),
  worn(4, "half_body", "seated on oak stool", "Seated, relaxed drape over the shoulders", { ...tagOff, environment: "indoor" }),
  worn(5, "low_angle", "open rooftop at dusk", "Low-angle lifestyle portrait outdoors", { ...tagOff, environment: "outdoor" }),
]);

/** What production actually planned on 3 Nov: folded still lifes, a hand lift, clutter in frame. */
export const bonkersRecordedPlan = plan(bonkersModelGoal, bonkersEvidence, [
  slot(0, { view: "front", humanAction: "none", subject: { referenceForm: "folded", componentStates: [] }, entityIds: ["product", "hang-tag"], distinction: "Folded tee on white with tag" }),
  slot(1, { view: "front", humanAction: "hands_holding", environment: "indoor", location: "bright interior", subject: { referenceForm: "folded", componentStates: [] }, distinction: "Hands lift the folded shirt" }),
  slot(2, { view: "top_down", humanAction: "none", environment: "indoor", location: "wardrobe flat lay", subject: { referenceForm: "folded", componentStates: [] }, entityIds: ["product", "green-garment"], distinction: "Folded tee beside the green garment" }),
  slot(3, { view: "front", humanAction: "none", environment: "outdoor", location: "park bench", subject: { referenceForm: "folded", componentStates: [] }, distinction: "Folded tee on a park bench" }),
  slot(4, { view: "detail", humanAction: "none", framing: "close", purpose: "detail", subject: { referenceForm: "folded", componentStates: [] }, distinction: "Collar material study" }),
  slot(5, { view: "macro", humanAction: "none", framing: "macro", purpose: "detail", subject: { referenceForm: "folded", componentStates: [] }, entityIds: ["product", "hang-tag"], distinction: "Collar, neck label and red tag" }),
]);

/* ------------------------------------------------------------------ */
/* Stitched flat menswear with back evidence: flat-to-worn and a back view are allowed. */

export const flatShirtEvidence = evidence({
  productId: "flat-shirt",
  sources: [src("a-front", "front"), src("a-back", "back")],
  identity: { category: "fashion", collection: "mens-modern", construction: "stitched", referenceForm: "flat", materials: ["cotton poplin"], colours: ["navy"], shape: "button-down shirt" },
  entities: [{ entityId: "product", role: "merchandise", label: "Navy button-down shirt", quantity: 1, sourceAssetIds: ["a-front", "a-back"] }],
  transformations: [ok("reposition"), ok("place_in_scene"), ok("wear")],
});
export const flatShirtGoal = goal({ productId: "flat-shirt", offering: "model_use", family: "model_worn", quantity: 2 });
export const flatShirtPlan = plan(flatShirtGoal, flatShirtEvidence, [
  worn(0, "full_body", "grey seamless", "Front standing, full length"),
  worn(1, "back", "grey seamless", "Back view showing the actual yoke", { referenceAssetIds: ["a-back"] }),
]);

/* ------------------------------------------------------------------ */
/* Unstitched dress material: never a finished worn garment (C10). */

export const unstitchedEvidence = evidence({
  productId: "unstitched-suit",
  sources: [src("a-front", "front"), src("a-detail", "detail")],
  identity: { category: "fashion", collection: "unstitched", construction: "unstitched", referenceForm: "folded", materials: ["cotton lawn"], colours: ["ivory", "teal print"] },
  entities: [
    { entityId: "product", role: "merchandise", label: "Unstitched top fabric", quantity: 1, sourceAssetIds: ["a-front"] },
    { entityId: "dupatta", role: "merchandise", label: "Printed dupatta", quantity: 1, sourceAssetIds: ["a-front"] },
    { entityId: "bottom", role: "merchandise", label: "Bottom fabric", quantity: 1, sourceAssetIds: ["a-front"] },
  ],
  locks: [{ kind: "piece_count", detail: "Three fabric pieces", sourceAssetIds: ["a-front"] }, { kind: "motif", detail: "Teal block-print motif and border", sourceAssetIds: ["a-detail"] }],
  transformations: [ok("reposition"), ok("place_in_scene"), ok("unfold"), ok("redrape"), { transformation: "wear", status: "unsupported", reason: "This is unstitched fabric. We can show the fabric and its print, not a finished outfit." }],
});
export const unstitchedWornGoal = goal({ productId: "unstitched-suit", offering: "model_use", family: "model_worn", quantity: 4 });

/* ------------------------------------------------------------------ */
/* FEEO Makeup Locking Spray (75 ml), capped and uncapped (jobs ab03cd23, 1fe675ee, a3f595f2). */

const feeoConfigs: ComponentConfiguration[] = [
  { configId: "c-capped", entityId: "product", component: "cap", state: "on", sourceAssetIds: ["a-front"] },
  { configId: "c-nozzle", entityId: "product", component: "spray head", state: "exposed", sourceAssetIds: ["a-detail"] },
];
export const feeoEvidence = evidence({
  productId: "feeo-spray",
  sources: [src("a-front", "front"), src("a-back", "back"), src("a-detail", "detail"), src("a-front2", "front")],
  identity: { category: "beauty", collection: "makeup", construction: "not_applicable", referenceForm: "object", materials: ["frosted plastic bottle", "black collar"], colours: ["white", "black"], shape: "cylindrical spray bottle" },
  entities: [
    { entityId: "product", role: "merchandise", label: "Makeup locking spray bottle, 75 ml", quantity: 1, sourceAssetIds: ["a-front", "a-back"] },
    { entityId: "cap", role: "merchandise", label: "Clear overcap", quantity: 1, sourceAssetIds: ["a-front"], partOf: "product" },
    { entityId: "second-can", role: "background", label: "Second bottle visible behind the product", sourceAssetIds: ["a-front2"] },
  ],
  facts: [{ factId: "f-volume", kind: "dimension", statement: "75 ml printed on label", sourceAssetIds: ["a-back"], certainty: "high", provenance: "readable" }],
  configurations: feeoConfigs,
  locks: [
    { kind: "component_geometry", detail: "Sloped actuator with black collar; do not replace with a generic nozzle", sourceAssetIds: ["a-detail"] },
    { kind: "piece_count", detail: "One bottle and one cap", sourceAssetIds: ["a-front"] },
  ],
  transformations: [ok("reposition"), ok("place_in_scene"), ok("show_component_state"), ok("hold"), { transformation: "apply", status: "needs_confirmation", reason: "Spray use on skin needs confirming.", question: "Is this sprayed on the face after makeup?" }],
});
export const feeoStudioGoal = goal({ productId: "feeo-spray", offering: "studio", family: "product_only_catalogue", quantity: 3, aspectRatio: "1:1" });
export const feeoStudioPlan = plan(feeoStudioGoal, feeoEvidence, [
  slot(0, { view: "front", humanAction: "none", subject: { referenceForm: "object", componentStates: [{ component: "cap", state: "on" }] }, distinction: "Capped front hero" }),
  slot(1, { view: "back", humanAction: "none", subject: { referenceForm: "object", componentStates: [{ component: "cap", state: "on" }] }, referenceAssetIds: ["a-back"], distinction: "Back label as printed" }),
  slot(2, { view: "detail", framing: "close", purpose: "detail", humanAction: "none", subject: { referenceForm: "object", componentStates: [{ component: "spray head", state: "exposed" }] }, referenceAssetIds: ["a-detail", "a-front"], distinction: "Exposed spray head and collar" }),
]);
/** Same evidence without the uncapped photo: the nozzle detail must be refused before generation. */
export const feeoNoNozzleEvidence: ProductEvidence = { ...feeoEvidence, evidenceRevision: 2, sources: feeoEvidence.sources.filter((s) => s.assetId !== "a-detail"), configurations: feeoConfigs.filter((c) => c.configId === "c-capped"), locks: feeoEvidence.locks.filter((l) => !l.sourceAssetIds.includes("a-detail")) };

/* ------------------------------------------------------------------ */
/* Pen set: repeated diagonals are not different views. */

export const pensEvidence = evidence({
  productId: "pen-set",
  sources: [src("a-front", "front"), src("a-angle", "angle")],
  identity: { category: "other", collection: "general", construction: "not_applicable", referenceForm: "object", materials: ["metal barrel"], colours: ["blue", "silver"] },
  entities: [{ entityId: "product", role: "merchandise", label: "Ballpoint pen", quantity: 3, sourceAssetIds: ["a-front"] }],
  locks: [{ kind: "piece_count", detail: "Three pens", sourceAssetIds: ["a-front"] }],
});
export const pensGoal = goal({ productId: "pen-set", offering: "studio", family: "product_only_catalogue", quantity: 3, aspectRatio: "1:1" });
export const pensPaddedPlan = plan(pensGoal, pensEvidence, [
  slot(0, { view: "three_quarter_left", humanAction: "none", lighting: "soft key", referenceAssetIds: ["a-front", "a-angle"], distinction: "Diagonal set" }),
  slot(1, { view: "three_quarter_left", humanAction: "none", lighting: "hard rim light", referenceAssetIds: ["a-front", "a-angle"], distinction: "Diagonal set with rim light" }),
  slot(2, { view: "three_quarter_left", humanAction: "none", lighting: "long shadow", referenceAssetIds: ["a-front", "a-angle"], distinction: "Diagonal set with a long shadow" }),
]);

/* ------------------------------------------------------------------ */
/* Multi-colour cap set: two caps, never a third. */

export const capsEvidence = evidence({
  productId: "cap-set",
  sources: [src("a-front", "front")],
  identity: { category: "fashion", collection: "general", construction: "stitched", referenceForm: "object", materials: ["cotton twill"], colours: ["red", "black"] },
  entities: [
    { entityId: "cap-red", role: "merchandise", label: "Red cap", quantity: 1, sourceAssetIds: ["a-front"] },
    { entityId: "cap-black", role: "merchandise", label: "Black cap", quantity: 1, sourceAssetIds: ["a-front"] },
  ],
  locks: [{ kind: "piece_count", detail: "Exactly two caps: one red, one black", sourceAssetIds: ["a-front"] }],
});

/* ------------------------------------------------------------------ */
/* Beverage: flavour on the label is not an ingredient claim. */

const bevFacts: Fact[] = [
  { factId: "f-flavour", kind: "flavour", statement: "Label reads Watermelon", sourceAssetIds: ["a-front"], certainty: "high", provenance: "readable" },
];
export const beverageEvidence = evidence({
  productId: "watermelon-can",
  sources: [src("a-front", "front"), src("a-side", "side")],
  identity: { category: "food", collection: "beverage", construction: "not_applicable", referenceForm: "object", materials: ["aluminium can"], colours: ["pink", "green"] },
  entities: [{ entityId: "product", role: "merchandise", label: "Watermelon soda can", quantity: 1, sourceAssetIds: ["a-front"] }],
  facts: bevFacts,
});
/** An ingredient guessed from colour must be rejected by evidence validation. */
export const beverageGuessedIngredient: ProductEvidence = { ...beverageEvidence, facts: [...bevFacts, { factId: "f-guess", kind: "ingredient", statement: "Contains real fruit juice", sourceAssetIds: ["a-front"], certainty: "low", provenance: "inferred" }] };
export const beverageGoal = goal({ productId: "watermelon-can", offering: "campaign", family: "campaign", quantity: 1 });
export const beveragePlan = (propFact: string) => plan(beverageGoal, beverageEvidence, [
  slot(0, { view: "three_quarter_left", humanAction: "none", environment: "outdoor", location: "sunlit poolside", referenceAssetIds: ["a-front", "a-side"], props: [{ item: "watermelon slices", justification: { factId: propFact } }], distinction: "Flavour-led summer hero" }),
]);

/* ------------------------------------------------------------------ */
/* General object that cannot be held: a vehicle (job 2f2c3d0a). */

export const suvEvidence = evidence({
  productId: "white-suv",
  sources: [src("a-front", "front", 3072, 2304)],
  identity: { category: "other", collection: "general", construction: "not_applicable", referenceForm: "object", materials: ["painted steel"], colours: ["white"], shape: "compact SUV" },
  entities: [{ entityId: "product", role: "merchandise", label: "White compact SUV", quantity: 1, sourceAssetIds: ["a-front"] }],
  transformations: [ok("reposition"), ok("place_in_scene"), { transformation: "hold", status: "unsupported", reason: "A vehicle cannot be held in a hand. Choose a lifestyle or studio shoot." }],
});
export const suvInHandGoal = goal({ productId: "white-suv", offering: "model_use", family: "product_in_use", quantity: 1 });

/* ------------------------------------------------------------------ */
/* UI state fixtures: long content and every result state (pack 02 §7, G19). */

export const LONG_NAME = "HC Nail Lacquer Shade 48 Mauve Rose Long Lasting Quick Dry Chip Resistant Glossy Finish 15 ml Pack of 2";

export const longSummary: ProductSummaryDTO = {
  productId: "long-name", name: LONG_NAME, collectionLabel: "Makeup",
  summary: "Two bottles of mauve rose nail lacquer with black caps.",
  preserveLine: "We'll keep the shade, the bottle shape and the printed label exactly as they are.",
  sources: [{ assetId: "a-front", viewRole: "front", thumbUrl: "/fixtures/nail-front.webp", fullUrl: "/fixtures/nail-front.webp", width: 2304, height: 3072 }],
  inventoryQuestions: [{ entityId: "box", question: "Include the printed box in your photos?" }],
  unknowns: ["The brush inside the cap is not shown"],
};

export const quoteFixtures: Record<"fresh" | "expired" | "insufficient", QuoteDTO> = {
  fresh: { quoteId: "q1", offering: "model_use", family: "model_worn", quantity: 6, aspectRatio: "4:5", slots: bonkersValidPlan.slots.map((s) => ({ purpose: s.purpose, label: s.distinction })), totalCredits: 6, balance: 40, resolution: { model: "gpt-image-2.5-sunburst", quality: "medium", nativeLongEdge: 1024, deliveredLongEdge: 2048 }, expiresAt: "2026-11-05T12:30:00Z", freshness: "fresh" },
  expired: { quoteId: "q2", offering: "studio", family: "product_only_catalogue", quantity: 3, aspectRatio: "1:1", slots: [{ purpose: "hero", label: "Capped front hero" }, { purpose: "alternate_view", label: "Back label" }, { purpose: "detail", label: "Spray head" }], totalCredits: 3, balance: 40, resolution: { model: "gpt-image-2.5-sunburst", quality: "medium", nativeLongEdge: 1024, deliveredLongEdge: 2048 }, expiresAt: "2026-11-05T09:00:00Z", freshness: "expired" },
  insufficient: { quoteId: "q3", offering: "campaign", family: "campaign", quantity: 6, aspectRatio: "9:16", slots: [], totalCredits: 6, balance: 2, resolution: { model: "gpt-image-2.5-sunburst", quality: "medium", nativeLongEdge: 1024, deliveredLongEdge: 2048 }, expiresAt: "2026-11-05T12:30:00Z", freshness: "fresh" },
};

const thumb = (n: number) => ({ thumbUrl: `/fixtures/out-${n}.webp`, fullUrl: `/fixtures/out-${n}.webp`, width: 1632, height: 2048, nativeLongEdge: 1024 });
const items: JobResultDTO["items"] = [
  { itemId: "i0", index: 0, purpose: "worn", label: "Standing front", state: "accepted", output: thumb(0), credit: "charged" },
  { itemId: "i1", index: 1, purpose: "worn", label: "Waist-up front", state: "review", output: thumb(1), reviewNote: "We couldn't confirm the logo placement. Check it before using this photo.", credit: "held" },
  { itemId: "i2", index: 2, purpose: "worn", label: "Mid-stride walk", state: "failed", failure: presentFailure("wrong_product", "The collar changed shape."), credit: "released" },
  { itemId: "i3", index: 3, purpose: "detail", label: "Chest crop", state: "failed", failure: presentFailure("missing_reference", "Add a photo of the back to make this view accurately."), credit: "released" },
  { itemId: "i4", index: 4, purpose: "worn", label: "Seated", state: "generating", credit: "reserved" },
  { itemId: "i5", index: 5, purpose: "worn", label: "Rooftop portrait", state: "failed", failure: presentFailure("provider_transient"), credit: "released" },
];
export const jobResultFixture: JobResultDTO = { jobId: "job-fixture", productName: LONG_NAME, offering: "model_use", family: "model_worn", aspectRatio: "4:5", sourceThumbs: longSummary.sources, items, summary: summarise(items), safeToLeave: true };

export const ALL_EVIDENCE: Record<string, ProductEvidence> = { bonkersEvidence, flatShirtEvidence, unstitchedEvidence, feeoEvidence, pensEvidence, capsEvidence, beverageEvidence, suvEvidence };
export type { Entity, Lock };
export { untrusted };
