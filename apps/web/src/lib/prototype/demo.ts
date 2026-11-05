/**
 * Fixture adapter for the Phase 2 prototype. Every screen reads from here, shaped by the shared
 * contracts in @packshot/core/contracts, so the engine can later replace this file without the
 * screens changing. Nothing here calls the network, the database or an image model.
 *
 * Images are existing static examples in /public. Each is labelled "Example" where it stands in
 * for a customer's future result. The customer's own raw photo is never shown as a fake preview.
 */
import type { AspectRatio, FailureReason, GoalFamily, ItemState, Offering, ResultItemDTO, SlotPurpose } from "@packshot/core/contracts";
import { presentFailure, summarise } from "@packshot/core/contracts";

export const DEMO = {
  user: { name: "Dhruv Mehta", email: "dhruv@example.in", workspace: "FEEO Beauty", balance: 37 },
  product: {
    id: "willow-lotion",
    name: "Willow & Bloom Nourishing Body Lotion 300 ml",
    collection: "Skincare",
    summary: "One bottle of body lotion with a black pump.",
    preserve: "We'll keep the label, the olive bottle and the pump exactly as they are.",
    raw: "/showcase/skincare-before.webp",
    sources: [{ id: "a-front", view: "front" as const, src: "/showcase/skincare-before.webp" }],
    clutter: "The other bottles on the counter",
    unknowns: ["The back label is not in your photos", "The lotion itself is not shown, so texture shots need a photo of it"],
  },
};

export type DirectionId = string;
export interface Direction { id: DirectionId; title: string; line: string; img: string; needs?: { ask: string; view: "back" | "detail" | "side" | "angle" } }
export interface OfferingCard { id: Offering; title: string; promise: string; img: string; family: GoalFamily; quantities: number[]; directions: Direction[]; maxFeasible: number; unlock?: string }

/** Studio examples use one consistent demo product (the FIELD bottle) across distinct views. */
export const OFFERINGS: OfferingCard[] = [
  {
    id: "studio", title: "Studio photos", promise: "Clear product photos on white for your listings and website.", img: "/showcase/studio/front.webp", family: "product_only_catalogue",
    quantities: [1, 3, 6], maxFeasible: 4, unlock: "Add a side photo to unlock 2 more angles.",
    directions: [
      { id: "white", title: "Pure white", line: "Marketplace ready", img: "/showcase/studio/front.webp" },
      { id: "shadow", title: "Soft shadow", line: "Gentle window light", img: "/showcase/studio/shadow.webp" },
      { id: "rim", title: "Defined edges", line: "Crisp rim light", img: "/showcase/studio/rim.webp" },
      { id: "angles", title: "Every angle", line: "Front, sides and back", img: "/showcase/studio/three-quarter.webp", needs: { ask: "Add a side photo for different angles", view: "side" } },
    ],
  },
  {
    id: "model_use", title: "Model & everyday use", promise: "Your product held, applied or used by a person.", img: "/showcase/skincare-2.webp", family: "product_in_use",
    quantities: [1, 3, 6], maxFeasible: 6,
    directions: [
      { id: "hand", title: "In hand", line: "Shows the real size", img: "/showcase/skincare-2.webp" },
      { id: "applied", title: "On skin", line: "The lotion in use", img: "/showcase/skincare-3.webp", needs: { ask: "Add a photo of the lotion itself", view: "detail" } },
      { id: "routine", title: "Daily routine", line: "A real bathroom moment", img: "/showcase/skincare-1.webp" },
    ],
  },
  {
    id: "campaign", title: "Creative campaign", promise: "A coordinated set with one clear idea, made for your product.", img: "/showcase/skincare-5.webp", family: "campaign",
    quantities: [3, 6], maxFeasible: 6,
    directions: [
      { id: "botanical", title: "Botanical morning", line: "Leaves, olives, soft sun", img: "/showcase/skincare-5.webp" },
      { id: "stone", title: "Stone and texture", line: "Travertine, calm light", img: "/showcase/skincare-4.webp" },
      { id: "spa", title: "Quiet spa", line: "Warm, minimal, clean", img: "/showcase/skincare-0.webp" },
    ],
  },
];

export const FORMATS: { id: AspectRatio; name: string; use: string; w: number; h: number }[] = [
  { id: "1:1", name: "Square", use: "Amazon, Flipkart", w: 22, h: 22 },
  { id: "4:5", name: "Portrait", use: "Instagram post", w: 20, h: 25 },
  { id: "9:16", name: "Story", use: "Reels, Status", w: 15, h: 27 },
  { id: "16:9", name: "Wide", use: "Website banner", w: 28, h: 16 },
];

/** Shot purposes the plan would contain, per offering. Labels are what each photo is for. */
export function planFor(o: Offering, quantity: number): { purpose: SlotPurpose; label: string }[] {
  const all: Record<Offering, { purpose: SlotPurpose; label: string }[]> = {
    studio: [
      // Slots 1-4 work from one front photo. 5-6 need a side photo (VIEW_NEEDS_SOURCE), so they unlock only with one.
      { purpose: "hero", label: "Front, label readable" }, { purpose: "hero", label: "Front with a soft shadow" },
      { purpose: "detail", label: "Pump and collar close-up" }, { purpose: "detail", label: "Label close-up" },
      { purpose: "alternate_view", label: "Turned, shows depth" }, { purpose: "alternate_view", label: "Side profile" },
    ],
    model_use: [
      { purpose: "scale", label: "Held in one hand" }, { purpose: "in_use", label: "Pressing the pump" }, { purpose: "context", label: "On the basin, mid routine" },
      { purpose: "scale", label: "Two hands, close" }, { purpose: "in_use", label: "Reaching for it" }, { purpose: "context", label: "Bedside shelf" },
    ],
    campaign: [
      { purpose: "hero", label: "Hero among leaves" }, { purpose: "campaign", label: "Morning light on stone" }, { purpose: "scale", label: "Held over the basin" },
      { purpose: "detail", label: "Pump in soft focus" }, { purpose: "context", label: "Olive branch still life" }, { purpose: "campaign", label: "Shadow play" },
    ],
  };
  return all[o].slice(0, quantity);
}

/** A finished campaign shoot in every result state the UI must handle. */
export function demoResult(): { items: ResultItemDTO[]; summary: ReturnType<typeof summarise> } {
  const out = (n: number) => ({ thumbUrl: `/showcase/skincare-${n}.webp`, fullUrl: `/showcase/skincare-${n}.webp`, width: 1632, height: 2048, nativeLongEdge: 1024 });
  const fail = (r: FailureReason, d?: string) => presentFailure(r, d);
  const items: ResultItemDTO[] = [
    { itemId: "r0", index: 0, purpose: "hero", label: "Hero among leaves", state: "accepted", output: out(5), credit: "charged" },
    { itemId: "r1", index: 1, purpose: "campaign", label: "Morning light on stone", state: "accepted", output: out(4), credit: "charged" },
    { itemId: "r2", index: 2, purpose: "scale", label: "Held over the basin", state: "review", output: out(2), reviewNote: "We couldn't confirm every word on the label. Zoom in before you use it.", credit: "held" },
    { itemId: "r3", index: 3, purpose: "detail", label: "Pump in soft focus", state: "failed", failure: fail("wrong_product", "The pump came out a different shape."), credit: "released" },
    { itemId: "r4", index: 4, purpose: "context", label: "Olive branch still life", state: "checking", credit: "reserved" },
    { itemId: "r5", index: 5, purpose: "campaign", label: "Shadow play", state: "generating", credit: "reserved" },
  ];
  return { items, summary: summarise(items) };
}

export const STATE_LABEL: Record<ItemState, string> = {
  queued: "Waiting", generating: "Creating", checking: "Checking accuracy", accepted: "Ready", review: "Check before use", failed: "Not delivered", cancelled: "Cancelled", superseded: "Replaced",
};

export const RECENT = [
  { id: "demo-job", name: DEMO.product.name, kind: "Creative campaign", when: "Today", img: "/showcase/skincare-5.webp", status: "4 of 6 ready" },
  { id: "demo-job", name: "Trail running shoe, olive green, size UK 9", kind: "Model & everyday use", when: "Yesterday", img: "/showcase/footwear-2.webp", status: "6 ready" },
  { id: "demo-job", name: "Gold-plated jhumka earrings with pearl drops", kind: "Studio photos", when: "Mon", img: "/showcase/earrings-0.webp", status: "3 ready" },
];

export const PRODUCTS = [
  { id: "willow-lotion", name: DEMO.product.name, img: "/showcase/skincare-before.webp", photos: 1, shoots: 2 },
  { id: "trail-shoe", name: "Trail running shoe, olive green, size UK 9", img: "/showcase/footwear-before.webp", photos: 3, shoots: 1 },
  { id: "jhumka", name: "Gold-plated jhumka earrings with pearl drops", img: "/showcase/earrings-before.webp", photos: 2, shoots: 1 },
];

export const HISTORY = [
  { when: "Today", what: "Returned: 1 photo we didn't deliver", delta: 1 },
  { when: "Today", what: "Creative campaign, 6 photos", delta: -6 },
  { when: "3 Nov", what: "Bought Brand pack", delta: 40 },
  { when: "30 Oct", what: "Free welcome photos", delta: 2 },
];
