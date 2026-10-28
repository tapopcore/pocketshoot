/** Mood words a brand kit can carry. Each one becomes a plain instruction for the image engine. */
export const BRAND_MOODS = ["Natural light", "Calm", "Warm", "Bold", "Luxury", "Playful", "Minimal", "Botanical"] as const;
export type BrandMood = (typeof BRAND_MOODS)[number];
