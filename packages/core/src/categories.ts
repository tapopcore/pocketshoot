/**
 * Launch niches. Each category carries preservation rules that are injected
 * into every prompt, and a difficulty flag shown to users before they spend credits.
 */
export type CategoryId =
  | "beauty"
  | "home_kitchen"
  | "food"
  | "jewellery"
  | "fashion"
  | "electronics"
  | "other";

export type Difficulty = "standard" | "harder";

export interface Category {
  id: CategoryId;
  label: string;
  labelHi: string;
  short: string;
  examples: string[];
  difficulty: Difficulty;
  /** Shown in the wizard when difficulty is "harder" or for known risks. */
  caution?: string;
  /** Things that must never change for this category. Added to prompts. */
  preserve: string[];
  /** Preset ids that suit this category, in recommended order. */
  recommendedPresets: string[];
  /** Default checkboxes on the "what must not change" step. */
  defaultLocks: LockId[];
}

export type LockId =
  | "label_text"
  | "logo"
  | "colour"
  | "shape"
  | "cap_closure"
  | "material"
  | "item_count";

export const LOCKS: Record<LockId, { label: string; labelHi: string; rule: string }> = {
  label_text: {
    label: "Label and printed text",
    labelHi: "लेबल और छपा हुआ टेक्स्ट",
    rule: "Every word, number and symbol printed on the product stays exactly as in the reference. Do not add, remove, translate or re-spell text.",
  },
  logo: {
    label: "Logo",
    labelHi: "लोगो",
    rule: "The brand logo keeps its exact shape, colours, position and size on the product.",
  },
  colour: {
    label: "Product colour",
    labelHi: "प्रोडक्ट का रंग",
    rule: "The product body, label and print colours match the reference. Scene lighting may add soft highlights but must not change the hue.",
  },
  shape: {
    label: "Shape and proportions",
    labelHi: "आकार और अनुपात",
    rule: "The product silhouette, height-to-width ratio and geometry match the reference exactly.",
  },
  cap_closure: {
    label: "Cap, lid, nozzle or handle",
    labelHi: "ढक्कन, नोज़ल या हैंडल",
    rule: "Caps, lids, pumps, nozzles and handles keep their exact type, colour and position.",
  },
  material: {
    label: "Material and finish",
    labelHi: "मटीरियल और फिनिश",
    rule: "Surface finish (matte, gloss, metallic, glass, ceramic, fabric) matches the reference.",
  },
  item_count: {
    label: "Number of items",
    labelHi: "आइटम की संख्या",
    rule: "Show exactly the same number of product units as the reference. Never duplicate the product.",
  },
};

export const CATEGORIES: Record<CategoryId, Category> = {
  beauty: {
    id: "beauty",
    label: "Beauty & skincare",
    labelHi: "ब्यूटी और स्किनकेयर",
    short: "Serums, creams, lipsticks, perfumes, tubes and jars",
    examples: ["Serum bottle", "Face cream jar", "Lipstick", "Perfume", "Shampoo"],
    difficulty: "standard",
    caution:
      "Clear glass and very glossy packaging can pick up odd reflections. Shoot in soft, even light for the best result.",
    preserve: [
      "Ingredient lists, claims and batch text on the label are never invented or changed.",
      "Pump, dropper and cap types stay exactly as in the reference.",
      "Liquid colour visible through transparent packaging stays the same.",
    ],
    recommendedPresets: ["pastel_podium", "botanical", "water_splash", "shadow_play", "marble_stone", "bathroom_vanity", "luxury_dark", "ingredients"],
    defaultLocks: ["label_text", "logo", "colour", "shape", "cap_closure"],
  },
  home_kitchen: {
    id: "home_kitchen",
    label: "Home, kitchen & decor",
    labelHi: "होम, किचन और डेकोर",
    short: "Cups, cookware, containers, decor pieces and small appliances",
    examples: ["Coffee mug", "Steel bottle", "Storage jar", "Planter", "Lamp"],
    difficulty: "standard",
    preserve: [
      "Handles, lids and spouts stay in the same position and shape.",
      "Patterns and prints on the surface are not redrawn.",
    ],
    recommendedPresets: ["kitchen_lifestyle", "living_room", "natural_sunlight", "shadow_play", "neutral_studio", "festive"],
    defaultLocks: ["logo", "colour", "shape", "material", "item_count"],
  },
  food: {
    id: "food",
    label: "Packaged food & FMCG",
    labelHi: "पैकेज्ड फ़ूड और FMCG",
    short: "Spices, snacks, beverages, sweets and pantry packs",
    examples: ["Masala pouch", "Chips packet", "Juice bottle", "Tea box", "Pickle jar"],
    difficulty: "standard",
    caution:
      "Packs with a lot of small print (nutrition tables, FSSAI details) are kept as-is from your photo. Make sure that text is sharp in the photo you upload.",
    preserve: [
      "Nutrition tables, FSSAI numbers, veg/non-veg marks, MRP and weight are never invented, removed or altered.",
      "Do not add health claims, certifications or awards that are not on the reference pack.",
      "Food props may appear around the pack but must not cover the brand name or front label.",
    ],
    recommendedPresets: ["ingredients", "dining_spread", "kitchen_lifestyle", "colour_pop", "cafe_table", "festive"],
    defaultLocks: ["label_text", "logo", "colour", "shape", "item_count"],
  },
  jewellery: {
    id: "jewellery",
    label: "Jewellery & accessories",
    labelHi: "ज्वेलरी और एक्सेसरीज़",
    short: "Rings, earrings, necklaces, watches, bags and sunglasses",
    examples: ["Gold ring", "Kundan earrings", "Chain", "Watch", "Leather wallet"],
    difficulty: "harder",
    caution:
      "Jewellery is the hardest category. Shiny metal and stones reflect their surroundings, and fine details can soften. Check every image at 100% zoom before using it. Credits come back for images where the piece has clearly changed.",
    preserve: [
      "Stone count, stone colour, setting style and metal colour stay exactly as in the reference.",
      "Engravings, hallmarks and clasp types are not altered.",
      "Do not place the piece on a human model unless the user chose a direction explicitly requesting a human interaction.",
    ],
    recommendedPresets: ["velvet_gold", "silk_satin", "luxury_dark", "marble_stone", "wedding", "dressing_table"],
    defaultLocks: ["shape", "colour", "material", "item_count", "logo"],
  },
  fashion: {
    id: "fashion",
    label: "Fashion & footwear",
    labelHi: "फ़ैशन और फ़ुटवियर",
    short: "Bags, shoes, watches, sunglasses, folded apparel",
    examples: ["Handbag", "Sneakers", "Watch", "Sunglasses", "Folded T-shirt"],
    difficulty: "standard",
    preserve: [
      "Stitching, hardware (buckles, zips, clasps) and logos keep their exact design and position.",
      "Fabric or leather texture, weave and colour match the reference.",
      "Prints and patterns keep their exact layout; do not invent new patterns.",
    ],
    recommendedPresets: ["shadow_play", "colour_pop", "silk_satin", "desk_workspace", "beach_sand", "neutral_studio"],
    defaultLocks: ["logo", "colour", "shape", "material", "item_count"],
  },
  electronics: {
    id: "electronics",
    label: "Electronics & gadgets",
    labelHi: "इलेक्ट्रॉनिक्स और गैजेट",
    short: "Earbuds, speakers, chargers, accessories",
    examples: ["Earbuds", "Power bank", "Smartwatch", "Speaker", "Phone case"],
    difficulty: "standard",
    preserve: [
      "Ports, buttons, LEDs, grilles and seams stay in the exact same place and count.",
      "Screens show exactly what the reference shows, or stay off; never invent UI.",
      "Logos and printed specs are unchanged.",
    ],
    recommendedPresets: ["gradient_glow", "desk_workspace", "luxury_dark", "neon_night", "colour_pop", "industrial"],
    defaultLocks: ["label_text", "logo", "colour", "shape", "item_count"],
  },
  other: {
    id: "other",
    label: "Something else",
    labelHi: "कुछ और",
    short: "Any other physical product",
    examples: ["Toy", "Stationery", "Electronics accessory", "Hardware"],
    difficulty: "standard",
    preserve: [],
    recommendedPresets: ["neutral_studio", "shadow_play", "premium_minimal", "natural_sunlight", "colour_pop", "pure_white"],
    defaultLocks: ["label_text", "logo", "colour", "shape", "item_count"],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === "string" && v in CATEGORIES;
}
