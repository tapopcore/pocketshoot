/**
 * Style presets (the scene) and output presets (the canvas).
 * Users pick these instead of writing prompts.
 */
import { SCENE_RECIPES, type SceneGroup, type SceneRecipe } from "./scenes";
import type { CategoryId } from "./categories";


export type StyleId = keyof typeof SCENE_RECIPES | "custom";

export interface StylePreset extends SceneRecipe {
  id: StyleId;
  name: string;
  nameHi: string;
  description: string;
  /** Two colours used by the sandbox provider. */
  swatch: [string, string];
  creativeOnly?: boolean;
}

const META: Record<StyleId, { name: string; nameHi: string; description: string; swatch: [string, string]; creativeOnly?: boolean }> = {
  pure_white: { name: "Pure White", nameHi: "सफ़ेद", description: "Clean white for catalogues and marketplaces", swatch: ["#FFFFFF", "#ECECEC"] },
  neutral_studio: { name: "Soft Studio", nameHi: "स्टूडियो", description: "Warm grey sweep, soft shadow. Works for anything", swatch: ["#D9D6D0", "#B9B4AC"] },
  shadow_play: { name: "Sun Shadows", nameHi: "धूप की परछाई", description: "Palm and window shadows on warm plaster", swatch: ["#EFE6D8", "#CDB99A"] },
  colour_pop: { name: "Colour Pop", nameHi: "कलर पॉप", description: "Bold single-colour set that makes the product pop", swatch: ["#FF8A5C", "#FF5F6D"] },
  pastel_podium: { name: "Pastel Podium", nameHi: "पेस्टल पोडियम", description: "Soft podiums and arches in pastel tones", swatch: ["#F3E4F1", "#E4DCF5"] },
  gradient_glow: { name: "Glow", nameHi: "ग्लो", description: "Colour halo and glossy reflection, tech-launch feel", swatch: ["#9FB8FF", "#1D1846"] },
  kitchen_lifestyle: { name: "Kitchen", nameHi: "किचन", description: "A real kitchen counter with soft blur", swatch: ["#EADBC8", "#8C6A4F"] },
  bathroom_vanity: { name: "Vanity", nameHi: "वैनिटी", description: "Spa-like bathroom counter", swatch: ["#EEF1EF", "#C7D3CD"] },
  dressing_table: { name: "Dressing Table", nameHi: "ड्रेसिंग टेबल", description: "Soft blush dressing table with dried flowers", swatch: ["#F6E7E1", "#D8B3A4"] },
  cafe_table: { name: "Café", nameHi: "कैफ़े", description: "Cosy café table with warm lights", swatch: ["#D9B48F", "#5D3C25"] },
  desk_workspace: { name: "Workspace", nameHi: "वर्कस्पेस", description: "Clean desk with laptop and plant", swatch: ["#EEF0EC", "#C1B49B"] },
  living_room: { name: "Living Room", nameHi: "लिविंग रूम", description: "Styled Indian living room", swatch: ["#E7D6C3", "#8E6C50"] },
  dining_spread: { name: "Dining Spread", nameHi: "डाइनिंग", description: "Plated food spread around the product", swatch: ["#F1DFC3", "#A1532C"] },
  natural_sunlight: { name: "Morning Sun", nameHi: "सुबह की धूप", description: "Linen, window light and leaf shadows", swatch: ["#F4E6C8", "#D9B98A"] },
  botanical: { name: "Botanical", nameHi: "बोटैनिकल", description: "Lush leaves, ferns and flowers", swatch: ["#DCE8D2", "#6E8F5E"] },
  water_splash: { name: "Water Splash", nameHi: "पानी", description: "Ripples, splash and droplets", swatch: ["#D4ECF4", "#5FA8C6"] },
  beach_sand: { name: "Beach", nameHi: "बीच", description: "Golden sand and sunny sky", swatch: ["#BFE6F5", "#E1C287"] },
  forest_moss: { name: "Forest", nameHi: "जंगल", description: "Moss, stones and soft forest light", swatch: ["#A9B99A", "#2F3F2A"] },
  ingredients: { name: "Ingredients", nameHi: "सामग्री", description: "Surrounded by its own key ingredients", swatch: ["#F6EFE4", "#9CCC65"] },
  luxury_dark: { name: "Luxury Dark", nameHi: "लग्ज़री डार्क", description: "Black set, rim light, mirror reflection", swatch: ["#2A2A2C", "#0E0E10"] },
  marble_stone: { name: "Marble", nameHi: "मार्बल", description: "Polished Carrara marble", swatch: ["#F2F0EC", "#9E9A94"] },
  velvet_gold: { name: "Velvet & Gold", nameHi: "वेलवेट और गोल्ड", description: "Jewel-tone velvet with gold accents", swatch: ["#1F6B55", "#07211B"] },
  silk_satin: { name: "Silk", nameHi: "सिल्क", description: "Flowing champagne satin", swatch: ["#F6EADB", "#D6B88F"] },
  premium_minimal: { name: "Minimal Plinth", nameHi: "मिनिमल", description: "Muted plinths and long shadows", swatch: ["#E8DDD3", "#A8927F"] },
  levitation: { name: "Levitation", nameHi: "हवा में", description: "Product floating with flying elements", swatch: ["#D9ECFF", "#B7C8F5"], creativeOnly: false },
  neon_night: { name: "Neon", nameHi: "नियॉन", description: "Pink and blue neon, moody reflections", swatch: ["#FF3CAC", "#2B86C5"] },
  ice_frost: { name: "Ice", nameHi: "बर्फ़", description: "Ice cubes, frost and cold mist", swatch: ["#F2FBFF", "#7FB8D6"] },
  smoke_mist: { name: "Smoke", nameHi: "धुआँ", description: "Moody swirling smoke", swatch: ["#8C8C94", "#141418"] },
  industrial: { name: "Concrete", nameHi: "कंक्रीट", description: "Raw concrete and steel", swatch: ["#9A9A96", "#4A4C4E"] },
  festive: { name: "Diwali", nameHi: "दिवाली", description: "Diyas, marigolds and warm lights", swatch: ["#F6C76B", "#B5481F"] },
  gifting: { name: "Gifting", nameHi: "गिफ़्टिंग", description: "Gift boxes, ribbons and confetti", swatch: ["#F7D6D0", "#C95F6A"] },
  holi_colours: { name: "Holi", nameHi: "होली", description: "Bursts of colour powder", swatch: ["#FF4FA0", "#3BCEAC"] },
  christmas: { name: "Christmas", nameHi: "क्रिसमस", description: "Tree, lights and ornaments", swatch: ["#1E4D2B", "#0E2616"] },
  wedding: { name: "Wedding", nameHi: "शादी", description: "Rose petals, mogra and gold", swatch: ["#F8E9DF", "#B8735D"] },
  summer: { name: "Summer", nameHi: "गर्मी", description: "Sunny pastels and citrus", swatch: ["#FFF4C2", "#FFAB76"] },
  monsoon: { name: "Monsoon", nameHi: "मानसून", description: "Rainy window and chai mood", swatch: ["#C9D6D3", "#57706A"] },
  custom: { name: "Your idea", nameHi: "आपका आइडिया", description: "Describe any scene in your own words", swatch: ["#FFFFFF", "#111111"] },
};

const CUSTOM_RECIPE: SceneRecipe = {
  group: "creative",
  scene: "",
  surface: "a surface that suits the scene",
  lighting: "natural, believable professional lighting that suits the scene",
  camera: "85mm lens, eye level",
  props: "only what the brief asks for",
  grade: "polished commercial colour",
  bestFor: ["all"],
  art: "conic-gradient(from 90deg, #ffb4a2, #e5989b, #b5838d, #6d6875, #ffb4a2)",
};

export const STYLES = Object.fromEntries(
  (Object.keys(META) as StyleId[]).map((id) => [id, { id, ...(id === "custom" ? CUSTOM_RECIPE : SCENE_RECIPES[id as keyof typeof SCENE_RECIPES]), ...META[id] }]),
) as Record<StyleId, StylePreset>;

/** Scenes ranked for a category: best fits first, then the rest. */
export function scenesFor(category: CategoryId): StylePreset[] {
  const list = Object.values(STYLES).filter((s) => s.id !== "custom");
  const score = (s: StylePreset) => (s.bestFor.includes(category) ? 2 : s.bestFor.includes("all") ? 1 : 0);
  return list.map((s, i) => ({ s, i })).sort((a, b) => score(b.s) - score(a.s) || a.i - b.i).map((x) => x.s);
}

export type { SceneGroup };

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
  portrait: { id: "portrait", name: "Portrait", ratio: "4:5", width: 1632, height: 2048, productScale: 0.6, baseline: 0.84, hint: "Instagram and Facebook feed ads" },
  story: { id: "story", name: "Story", ratio: "9:16", width: 1152, height: 2048, productScale: 0.66, baseline: 0.78, hint: "Stories, Reels covers, WhatsApp status" },
  landscape: { id: "landscape", name: "Landscape", ratio: "16:9", width: 2048, height: 1152, productScale: 0.66, baseline: 0.86, hint: "Website banners, YouTube, presentations" },
  marketplace_white: {
    id: "marketplace_white", name: "Marketplace white", ratio: "1:1", width: 2048, height: 2048, productScale: 0.85, baseline: 0.93, forceStyle: "pure_white",
    hint: "White background with the product filling most of the frame. Check each marketplace's current rules before listing.",
  },
  website_hero: { id: "website_hero", name: "Website hero", ratio: "21:9", width: 2560, height: 1088, productScale: 0.72, baseline: 0.88, hint: "Wide homepage banners with space for text" },
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
