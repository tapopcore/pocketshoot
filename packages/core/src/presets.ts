/**
 * Style presets (the scene) and output presets (the canvas).
 * Users pick these instead of writing prompts.
 */

export type StyleId =
  | "pure_white"
  | "neutral_studio"
  | "premium_minimal"
  | "natural_sunlight"
  | "botanical"
  | "marble_stone"
  | "water_splash"
  | "festive"
  | "industrial"
  | "kitchen_lifestyle"
  | "luxury_dark"
  | "custom";

export interface StylePreset {
  id: StyleId;
  name: string;
  nameHi: string;
  description: string;
  /** Scene description sent to the model. Never contains product details. */
  scene: string;
  lighting: string;
  /** Props allowed in the frame. Empty means none. */
  props: string;
  /** Swatch colours used for the preset card in the UI. */
  swatch: [string, string];
  /** Creative mode only: presets that need more freedom than Preserve gives. */
  creativeOnly?: boolean;
}

export const STYLES: Record<StyleId, StylePreset> = {
  pure_white: {
    id: "pure_white",
    name: "Pure White",
    nameHi: "सफ़ेद बैकग्राउंड",
    description: "Clean white background for catalogues and marketplaces.",
    scene: "a seamless pure white (#FFFFFF) studio background with no visible horizon line",
    lighting: "soft, even, shadowless-looking key light with a faint natural contact shadow directly under the product",
    props: "no props",
    swatch: ["#FFFFFF", "#ECECEC"],
  },
  neutral_studio: {
    id: "neutral_studio",
    name: "Neutral Studio",
    nameHi: "न्यूट्रल स्टूडियो",
    description: "Warm grey sweep with soft shadows. Works for almost anything.",
    scene: "a warm light-grey paper sweep studio backdrop",
    lighting: "large softbox from the upper left, gentle fill, a soft realistic shadow falling to the right",
    props: "no props",
    swatch: ["#D9D6D0", "#B9B4AC"],
  },
  premium_minimal: {
    id: "premium_minimal",
    name: "Premium Minimal",
    nameHi: "प्रीमियम मिनिमल",
    description: "Muted colour, simple plinths and long shadows. Feels expensive.",
    scene: "a minimal set with one or two matte geometric plinths in a muted tone that complements the product colours",
    lighting: "directional hard-soft light creating long elegant shadows, calm editorial mood",
    props: "only simple geometric plinths or blocks",
    swatch: ["#E8DDD3", "#A8927F"],
  },
  natural_sunlight: {
    id: "natural_sunlight",
    name: "Natural Sunlight",
    nameHi: "धूप वाली रोशनी",
    description: "Morning sun, window shadows and a linen surface.",
    scene: "a light linen or pale wood tabletop near a window",
    lighting: "warm morning sunlight with soft window-pane and leaf shadows across the surface",
    props: "at most a sprig of greenery or a folded cloth, kept away from the product front",
    swatch: ["#F4E6C8", "#D9B98A"],
  },
  botanical: {
    id: "botanical",
    name: "Botanical",
    nameHi: "बोटैनिकल",
    description: "Fresh leaves and flowers around the product.",
    scene: "a fresh botanical setting with green leaves and a few flowers arranged around the base",
    lighting: "bright diffused daylight, fresh and clean",
    props: "leaves, petals and small flowers that never overlap the product label",
    swatch: ["#DCE8D2", "#6E8F5E"],
  },
  marble_stone: {
    id: "marble_stone",
    name: "Marble & Stone",
    nameHi: "मार्बल और स्टोन",
    description: "Polished marble or textured stone surfaces.",
    scene: "a polished white marble surface with subtle grey veins and a softly blurred stone backdrop",
    lighting: "soft overhead studio light with a gentle reflection of the product on the marble",
    props: "no props, or one small stone",
    swatch: ["#F2F0EC", "#9E9A94"],
  },
  water_splash: {
    id: "water_splash",
    name: "Water & Splash",
    nameHi: "पानी और स्प्लैश",
    description: "Water ripples and droplets. Great for skincare and drinks.",
    scene: "a shallow clear water surface with gentle ripples and a few droplets in the air behind the product",
    lighting: "crisp backlight making the water sparkle, cool fresh mood",
    props: "water only; droplets must not cover the label",
    swatch: ["#D4ECF4", "#5FA8C6"],
  },
  festive: {
    id: "festive",
    name: "Festive",
    nameHi: "त्योहार",
    description: "Diyas, marigolds and warm lights for Diwali and gifting.",
    scene: "a warm festive Indian setting with softly blurred fairy lights, a few marigold flowers and brass diyas in the background",
    lighting: "warm golden glow with soft bokeh",
    props: "diyas, marigolds and lights placed beside or behind the product, never in front of it",
    swatch: ["#F6C76B", "#B5481F"],
  },
  industrial: {
    id: "industrial",
    name: "Industrial",
    nameHi: "इंडस्ट्रियल",
    description: "Concrete, steel and raw textures. Good for tools and hardware.",
    scene: "a raw concrete surface with a dark steel or brushed metal backdrop",
    lighting: "cool directional light with defined shadows",
    props: "no props",
    swatch: ["#9A9A96", "#4A4C4E"],
  },
  kitchen_lifestyle: {
    id: "kitchen_lifestyle",
    name: "Kitchen Lifestyle",
    nameHi: "किचन लाइफ़स्टाइल",
    description: "A real-looking kitchen counter with soft background blur.",
    scene: "a modern Indian home kitchen counter with softly blurred background details",
    lighting: "natural window light from the side, homely and inviting",
    props: "a few relevant ingredients or utensils kept behind or beside the product",
    swatch: ["#EADBC8", "#8C6A4F"],
  },
  luxury_dark: {
    id: "luxury_dark",
    name: "Luxury Dark",
    nameHi: "लग्ज़री डार्क",
    description: "Deep black or charcoal with dramatic rim light.",
    scene: "a deep charcoal-black backdrop on a dark glossy surface",
    lighting: "dramatic rim lighting outlining the product edges, a controlled highlight on the front",
    props: "no props",
    swatch: ["#2A2A2C", "#0E0E10"],
  },
  custom: {
    id: "custom",
    name: "Custom brief",
    nameHi: "अपना ब्रीफ़",
    description: "Describe the scene in your own words.",
    scene: "",
    lighting: "natural, believable studio lighting that suits the scene",
    props: "only what the brief asks for",
    swatch: ["#FFFFFF", "#111111"],
  },
};

export const STYLE_LIST = Object.values(STYLES);

export type OutputId = "square" | "portrait" | "story" | "landscape" | "marketplace_white" | "website_hero";

export interface OutputPreset {
  id: OutputId;
  name: string;
  ratio: string;
  width: number;
  height: number;
  /** Where the product sits and how big it is (fraction of the shorter side). */
  productScale: number;
  /** Vertical anchor of the product's base, 0 = top, 1 = bottom. */
  baseline: number;
  /** Forces the pure white style regardless of what the user picks. */
  forceStyle?: StyleId;
  hint: string;
}

export const OUTPUTS: Record<OutputId, OutputPreset> = {
  square: { id: "square", name: "Square", ratio: "1:1", width: 2048, height: 2048, productScale: 0.62, baseline: 0.84, hint: "Instagram feed, Shopify product pages" },
  portrait: { id: "portrait", name: "Portrait", ratio: "4:5", width: 1638, height: 2048, productScale: 0.6, baseline: 0.84, hint: "Instagram and Facebook feed ads" },
  story: { id: "story", name: "Story", ratio: "9:16", width: 1152, height: 2048, productScale: 0.66, baseline: 0.78, hint: "Stories, Reels covers, WhatsApp status" },
  landscape: { id: "landscape", name: "Landscape", ratio: "16:9", width: 2048, height: 1152, productScale: 0.66, baseline: 0.86, hint: "Website banners, YouTube, presentations" },
  marketplace_white: {
    id: "marketplace_white", name: "Marketplace white", ratio: "1:1", width: 2048, height: 2048, productScale: 0.85, baseline: 0.93, forceStyle: "pure_white",
    hint: "White background with the product filling most of the frame. Check each marketplace's current rules before listing.",
  },
  website_hero: { id: "website_hero", name: "Website hero", ratio: "21:9", width: 2560, height: 1097, productScale: 0.72, baseline: 0.88, hint: "Wide homepage banners with space for text" },
};

export const OUTPUT_LIST = Object.values(OUTPUTS);

/** Trial outputs are capped at this long edge. */
export const TRIAL_MAX_EDGE = 1024;

export function isStyleId(v: unknown): v is StyleId {
  return typeof v === "string" && v in STYLES;
}
export function isOutputId(v: unknown): v is OutputId {
  return typeof v === "string" && v in OUTPUTS;
}

/** The aspect ratio string closest to the preset, from a provider's supported list. */
export function nearestRatio(width: number, height: number, supported: string[]): string {
  const target = width / height;
  let best = supported[0];
  let bestDiff = Infinity;
  for (const r of supported) {
    const [a, b] = r.split(":").map(Number);
    const diff = Math.abs(Math.log(a / b) - Math.log(target));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}
