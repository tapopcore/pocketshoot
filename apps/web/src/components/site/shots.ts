/**
 * What each showcase photo in /public/showcase actually shows: `${category}-${index}.webp`.
 * One source of truth so every caption on the site matches its picture.
 */
export const SHOT_LABELS: Record<string, [string, string, string, string, string, string]> = {
  skincare: ["Studio", "In hand", "On skin", "Texture", "Botanical", "Close-up"],
  beverage: ["Window light", "With a model", "Pouring", "Close-up", "Seaside table", "Bottle detail"],
  saree: ["Studio drape", "Courtyard walk", "Seated portrait", "Border close-up", "Fabric flat lay", "Full drape"],
  rings: ["Studio", "On the hand", "Outdoor", "Stone close-up", "On silk", "Band detail"],
  footwear: ["Outdoors", "On the trail", "Lacing up", "Mesh close-up", "Studio plinth", "Sole detail"],
  electronics: ["Studio", "In hand", "With a model", "Port close-up", "Desk setup", "Headband detail"],
  bags: ["Studio", "Café", "Street", "Hardware close-up", "Inside view", "Leather detail"],
  fragrance: ["Studio", "In hand", "With a model", "Label close-up", "With flowers", "Glass detail"],
  necklace: ["Studio", "On the neck", "Portrait", "Pendant close-up", "On marble", "Clasp detail"],
  "prepared-food": ["Studio", "Slicing", "Serving", "Close-up", "Table setting", "Texture"],
  decor: ["Living room", "With a model", "Styled throw", "Fabric touch", "Studio", "Texture"],
  lehenga: ["Studio", "Courtyard", "Seated", "Embroidery close-up", "Twirl", "Flat lay"],
  makeup: ["Studio", "With a model", "Applying", "Swatch", "Styled flat lay", "Close-up"],
  cookware: ["Studio", "Cooking", "Serving", "Handle close-up", "Dinner table", "Lid detail"],
  "mens-ethnic": ["Studio", "Courtyard", "Seated", "Collar close-up", "Folded set", "Fabric detail"],
  "packaged-food": ["Studio", "Serving", "Pantry shelf", "Close-up", "Breakfast table", "Texture"],
  earrings: ["Studio", "On the ear", "Portrait", "Close-up", "Styled", "Stone detail"],
  bracelets: ["Studio", "On the wrist", "Outdoor", "Stone close-up", "On linen", "Chain detail"],
  activewear: ["Studio", "On the track", "After a workout", "Fabric close-up", "Flat lay", "Mesh detail"],
  bottle: ["Outdoors", "On a hike", "At the desk", "Lid close-up", "Studio", "Base detail"],
  "mens-modern": ["Studio", "Street", "At work", "Fabric close-up", "Flat lay", "Outdoor"],
  suit: ["Studio", "Courtyard", "Seated", "Neckline close-up", "Flat lay", "Garden"],
  unstitched: ["Studio flat lay", "Fabric fold", "In hand", "Embroidery close-up", "Styled set", "Texture"],
  "womens-modern": ["Studio", "Outdoor", "Seated", "Sleeve close-up", "Flat lay", "Print detail"],
};

export const shotLabel = (key: string) => {
  const m = key.match(/^(.*)-(\d)$/);
  return m ? SHOT_LABELS[m[1]]?.[Number(m[2])] ?? "" : "";
};
