/**
 * Baby Shoot theme cards (newborn, birth to about 10 weeks).
 * Written from the founder's reference study. Each card is a description of a studio set,
 * never a copy of a specific photograph. No characters, brands or lettering.
 */
export type BabyFamily = "Classic" | "Minimal" | "Floral" | "Fine art" | "Night sky" | "Playful" | "Indian";
export type BabyCamera = "overhead" | "eye" | "close";
export type BabyState = "asleep" | "awake";
export type BabyShape = "4:5" | "1:1" | "9:16";

export interface BabyTheme {
  id: string;
  name: string;
  family: BabyFamily;
  blurb: string;
  /** Two colours for the card swatch. */
  swatch: [string, string];
  set: string;
  wear: string;
  pose: string;
  camera: BabyCamera;
  light: "soft" | "lowkey";
}

const T = (id: string, name: string, family: BabyFamily, blurb: string, swatch: [string, string], set: string, wear: string, pose: string, camera: BabyCamera, light: "soft" | "lowkey" = "soft"): BabyTheme =>
  ({ id, name, family, blurb, swatch, set, wear, pose, camera, light });

export const BABY_THEMES: BabyTheme[] = [
  T("heart-bowl", "Heart bowl", "Classic", "Wooden heart bowl, soft lavender", ["#d9c3dc", "#b98aa8"], "a carved heart-shaped wooden bowl lined with a soft knit layer, on a hand-painted lavender and pink watercolour backdrop", "a stretchy dusty-pink knit wrap around the whole body, a thin headband with one small fabric flower", "swaddled and lying on the back inside the bowl, head at the top of the heart", "overhead"),
  T("cane-basket", "Cane basket", "Classic", "Oval cane basket, mauve wrap", ["#c9a2b1", "#8c5f74"], "an oval cane basket lined with a printed muslin cushion, small pink blossoms scattered on a soft mauve floor around it", "a mauve jersey wrap around the whole body with both hands tucked out near the chin, a floral headband", "swaddled on the back in the basket", "overhead"),
  T("white-bucket", "White bucket", "Classic", "Bright, airy, flower crown", ["#f4eeee", "#e8c9cf"], "a small white enamel bucket draped with frayed blush muslin, two pink carnations at its base, seamless pale grey-white backdrop", "a blush wrap around the body below the arms, a soft flower crown", "resting upright in the bucket with the chin on folded arms over the rim", "eye"),
  T("wooden-bowl", "Wooden bowl", "Classic", "Cream wool, white fur", ["#efe6da", "#b98b5e"], "an oval hand-turned wooden bowl filled with chunky cream merino wool, set on a white long-pile fur rug", "an oatmeal cheesecloth wrap around the whole body", "swaddled on the back, head resting on the wool", "overhead"),
  T("blue-basket", "Blue basket", "Classic", "Layered blue knits", ["#b9cfe0", "#5f7fa6"], "a woven seagrass basket layered with a navy blanket and a pale-blue chunky knit, on a light whitewashed wood floor", "a light-blue stretch wrap around the whole body with fingers peeking out at the chest", "swaddled on the back in the basket", "overhead"),
  T("cream", "Cream on cream", "Minimal", "One colour, lots of texture", ["#f3ebdf", "#d9c8b0"], "a plain warm-beige seamless backdrop with a small lace-trimmed pompom pillow", "an ivory textured wrap around the whole body, a narrow headband of tiny cream flowers", "swaddled on the back, head on the pillow, body on a gentle diagonal", "overhead"),
  T("sage", "Sage", "Minimal", "Sage wrap on sage wool", ["#b9c2a6", "#6f7a5c"], "a deep sage-green curly flokati wool rug filling the whole frame", "a lighter sage cheesecloth wrap wound in many layers around the whole body", "swaddled on the back, nestled into the wool", "overhead"),
  T("rust-beret", "Rust beret", "Minimal", "Knit beret and tiny teddy", ["#e9b9a0", "#b0532f"], "soft peach long-pile fur filling the frame, softly out of focus in front and behind", "a rust-orange knit wrap around the whole body, a matching knit beret, a tiny hand-knitted rust teddy held against the cheek", "wrapped upright in the classic potato-sack pose, chin resting on the hands", "eye"),
  T("pink-crate", "Little bed", "Minimal", "Whitewashed crate, rose tones", ["#e2b3b8", "#b77a86"], "a small whitewashed wooden crate bed set on a diagonal, lined with curly cream wool, on a plain dusty-rose backdrop, with a length of rose muslin trailing out of the crate", "a rose knit wrap around the whole body, a fine mohair bonnet in the same rose, a tiny knitted teddy under the hands", "swaddled on the back in the crate", "overhead"),
  T("flower-nest", "Flower nest", "Floral", "Wreath of pastel flowers", ["#eee4dc", "#b9a5c4"], "a round woven nest filled with cream wool, ringed by a full wreath of muted pastel flowers (dusty lilac, pale blue, ivory, eucalyptus), on a soft plaster-textured cream backdrop with generous empty space", "a white wrap around the body and hips with arms and feet free, a small white bow headband", "lying on the back in the middle of the nest", "overhead"),
  T("blue-bloom", "Blue bloom", "Floral", "Blue flowers, petal bed", ["#c9dcf0", "#3f6fb5"], "a bed shaped like the layered petals of a pale-blue flower, framed on all sides by blue hydrangea and delphinium stems, on a soft blue-grey floor", "a slate-blue open-knit wrap around the whole body with hands under the chin", "swaddled on the back at the centre of the petals", "overhead"),
  T("rose-heart", "Rose heart", "Floral", "Heart bowl filled with roses", ["#f1d5cf", "#d77f86"], "a carved heart-shaped wooden bowl packed around the edges with fresh pink and peach roses and tiny white filler flowers, on a warm cream plaster backdrop", "a pale-pink mohair wrap around the whole body, a pink headband with small flowers", "swaddled on the back among the roses", "overhead"),
  T("sunflower", "Sunflower", "Floral", "Ring of sunflowers, warm yellow", ["#f3c552", "#c98a1c"], "a round wooden bowl filled with mustard-yellow curly wool, with a ring of sunflowers laid around it on a warm ochre backdrop", "a mustard jersey wrap wound around the torso and hips with arms and feet free, a delicate headband of tiny yellow dried flowers", "curled on the side in the bowl with knees tucked up and hands by the face", "overhead"),
  T("gold-frame", "Framed", "Floral", "Gold frame, pearls, peach fur", ["#f2c4b3", "#c9a962"], "an ornate antique gold picture frame lying flat on peach long-pile fur, strings of pearls draped over two corners, white ranunculus at the lower corner", "a coral jersey wrap around the whole body with hands and toes peeking out, a headband with one peach silk flower", "swaddled on the back inside the frame, like a painting", "overhead"),
  T("dark-crate", "Autumn crate", "Fine art", "Moody browns, tweed knit", ["#7a5a3e", "#2f2118"], "a small dark wooden crate on worn dark floorboards with a brown wool layer, deep brown shadows all around", "a multi-tone brown and teal tweed-knit wrap around the whole body with a matching knit bonnet tied under the chin", "wrapped upright in the crate with the head tilted on the hands", "close", "lowkey"),
  T("gold-palm", "Gold palm", "Fine art", "Maroon and gold on black", ["#7d1f33", "#c9a24a"], "a low basket filled with ochre and charcoal curly wool, surrounded by a radiating burst of gold-painted dried palm fans, on a near-black backdrop", "a deep maroon wrap around the body and hips with one foot and the hands free, a maroon knit sleepy hat with a pom", "swaddled on the back at the centre of the burst", "overhead", "lowkey"),
  T("stump", "Woodland", "Fine art", "Tree stump, wild flowers", ["#5b4a3a", "#8fa07a"], "a short tree stump topped with a cream wool layer, wrapped at its base with trailing greenery and small lilac, blue and white wild flowers, on dark wooden floorboards fading to black", "an ivory wrap over the back and hips, arms bare, a slim headband with a small flower", "lying on the tummy on top of the stump with the cheek resting on folded arms", "eye", "lowkey"),
  T("noir", "Noir", "Fine art", "Black on black", ["#3a3a40", "#0f0f12"], "a matte black backdrop with nothing else in frame", "a black cheesecloth wrap around the whole body, gathered above the head like a tied bundle, a tiny muted floral headband", "swaddled on the back, only the face catching the light", "overhead", "lowkey"),
  T("moon", "Crescent moon", "Night sky", "Moon bed, stars", ["#27304f", "#e8e2d0"], "a crescent-moon shaped bed in brushed antique gold, padded with soft white wool like a cloud, small gold stars and soft out-of-focus sparkles around it, on a pale silver-grey backdrop", "an ivory wrap around the whole body", "swaddled and sleeping in the curve of the moon", "eye"),
  T("stars", "Starry night", "Night sky", "Navy sky, silver stars", ["#1c2440", "#8fa3c7"], "a deep navy fabric backdrop scattered with small white stars and a few larger silver felt stars", "a denim-blue jersey wrap around the whole body, a matching soft beanie with a small fur pom", "swaddled on the back in the middle of the sky", "overhead"),
  T("baker", "Little baker", "Playful", "Bread, tiny glasses, warm brown", ["#b06a3b", "#e6c38c"], "a warm brown textured backdrop with a long baguette on one side and two round bread rolls and a small pastry on the other, a little lace-edged pillow", "a natural burlap-coloured cheesecloth wrap around the whole body, tiny round prop glasses resting on the nose", "swaddled on the back, head on the pillow", "overhead"),
  T("rose-bud", "Rose bud", "Playful", "Tucked inside a rose", ["#a8323a", "#3f5d34"], "a large rose made of soft red felt petals with green felt sepals beneath, on a dark brown mottled backdrop", "an ivory wrap around the whole body with the hands and toes peeking out", "swaddled and nestled inside the petals as if the rose is opening", "overhead", "lowkey"),
  T("bear", "Sleepy bear", "Playful", "Bear bonnet and a big teddy", ["#dfe5ec", "#8f9fb3"], "a white long-pile fur rug with a big fluffy grey-blue teddy bear lying beside the baby", "a fluffy grey-blue knitted romper with wooden buttons and a matching bonnet with small bear ears", "lying on the back beside the teddy, one arm relaxed out to the side", "overhead"),
  T("wings", "Angel wings", "Playful", "Feather wings, soft grey", ["#e7e3dc", "#b7b2a8"], "a soft heart-shaped ivory cushion with a pair of large wings made of ivory feathers spreading out from either side, on a plain warm-grey backdrop with lots of empty space", "an ivory wrap around the whole body", "swaddled on the back on the heart, small in the frame", "overhead"),
  T("krishna", "Little Krishna", "Indian", "Peacock feather and flute", ["#f3efe6", "#c9a24a"], "soft white fur with two peacock feathers laid in the background and a small decorated wooden flute beside the baby", "a white wrap with a woven gold border laid diagonally across it, a thin gold cord headband with a string of small pearls and a single short peacock feather", "swaddled on the back, one hand resting by the cheek", "overhead"),
  T("peacock", "Peacock", "Indian", "Feather fan, deep green", ["#1f5a3a", "#2c7fb8"], "a full fan of real peacock feathers spread out behind the baby like a tail, on a deep green mottled backdrop that falls to darkness at the edges", "a deep green open-knit wrap around the whole body with a matching knit hood", "wrapped upright in front of the feather fan, so the baby reads as the body of the peacock", "overhead", "lowkey"),
  T("shiva", "Shiv bhakt", "Indian", "Saffron, rudraksha, mountains", ["#e8862a", "#3d5a80"], "an ivory textured blanket in the foreground and a painted backdrop of blue Himalayan peaks behind, a small brass trishul standing to one side and a small damru drum in front", "a plain saffron cotton cloth wrapped around the whole body with no printing or lettering on it, a string of rudraksha beads over the wrap, a small sandalwood tilak on the forehead", "wrapped upright in the potato-sack pose, face level with the camera", "eye"),
  T("silk", "Festive silk", "Indian", "Red and green silk, gold", ["#b3261e", "#1f6b4a"], "a round woven basket on a deep maroon mottled backdrop with a small brass lantern at the edge of the frame", "a red silk cloth with small woven gold motifs wrapped around the whole body, a green silk border folded across the chest, a traditional gold necklace laid over the wrap, a tiny red bindi", "wrapped upright in the basket, seen from slightly above", "close", "lowkey"),
  T("tiranga", "Tiranga", "Indian", "Saffron, white and green", ["#f08a24", "#1f7a3d"], "a carved heart-shaped wooden bowl lined with cream curly wool on a deep blue mottled backdrop, with three long ribbons of saffron, white and green chiffon flowing diagonally across the floor beside it", "a soft blue jersey wrap around the whole body", "swaddled on the back in the bowl", "overhead"),
];

export const BABY_FAMILIES: BabyFamily[] = ["Classic", "Minimal", "Floral", "Fine art", "Night sky", "Playful", "Indian"];
export const BABY_SIZES: Record<BabyShape, { width: number; height: number }> = { "4:5": { width: 1024, height: 1280 }, "1:1": { width: 1152, height: 1152 }, "9:16": { width: 864, height: 1536 } };
export const babyTheme = (id: string) => BABY_THEMES.find((t) => t.id === id);

const CAMERA: Record<BabyCamera, string> = {
  overhead: "Camera directly overhead, looking straight down, the whole set visible with calm empty space around it.",
  eye: "Camera low and level with the baby, 85mm portrait lens at f/2.8, background falling softly out of focus.",
  close: "Camera close and slightly above, 85mm lens at f/2.8, the face large in the frame with shallow depth of field.",
};
const LIGHT = {
  soft: "One large soft window-style light from the upper left at about 45 degrees, gentle shadow falling toward the lower right, no flash look, no hard highlights.",
  lowkey: "Low-key lighting: one soft light from the upper left pooling on the baby, the surroundings falling away into deep shadow.",
};

const LOOK = "Look: a real photograph from a high-end newborn studio. Natural skin with fine texture, tiny creases, soft peach fuzz and slight natural redness; real fabric weave and wool fibres; believable contact shadows. Not airbrushed, not waxy, not a 3D render, not an illustration. One colour family across wrap, props and backdrop, with at most one accent.";
const ALWAYS = "Always: the hips and nappy area are fully covered by the wrap or outfit. One baby only, no adults or hands in frame. No text, letters, numbers, logos, brand names, watermarks or borders anywhere.";
const eyesLine = (state: BabyState) => state === "awake"
  ? "The baby is awake and calm with eyes open, looking toward the camera, in a relaxed natural expression."
  : "The baby is peacefully asleep with eyes closed and a relaxed face.";
const scene = (theme: BabyTheme, state: BabyState) => [
  `Set: ${theme.set}.`,
  `Styling: ${theme.wear}.`,
  `Pose: ${theme.pose}. ${eyesLine(state)} The pose must be one a real sleeping newborn can safely hold, with the head and neck supported.`,
  CAMERA[theme.camera],
  LIGHT[theme.light],
  LOOK,
];

/** One prompt per photo. The same safety and realism rules are appended to every theme. */
export function babyPrompt(theme: BabyTheme, state: BabyState, references: number): string {
  return [
    `Create a new professional newborn studio photograph of the same baby shown in the reference photo${references > 1 ? "s" : ""}.`,
    "Identity: this must be recognisably the same child. Keep the exact face shape, eyes, eyebrows, nose, lips, cheeks, ears, skin tone, birthmarks, hair colour, hairline and amount of hair. Do not beautify, slim, lighten or age the face. Keep true newborn proportions.",
    ...scene(theme, state),
    `${ALWAYS} Replace everything from the original background and clothing.`,
  ].join("\n");
}

/** The picture on a theme card: an invented baby, never a customer's child. */
export function babyExamplePrompt(theme: BabyTheme): string {
  return [
    "Create a professional newborn studio photograph of an invented baby who is not a real person: a healthy two-week-old Indian newborn with soft dark hair and true newborn proportions.",
    ...scene(theme, "asleep"),
    ALWAYS,
  ].join("\n");
}

/** Spread a shoot across families so a batch feels like several setups, not one repeated. */
export function mixThemes(count: number, seed = Date.now()): BabyTheme[] {
  let s = seed % 2147483647 || 1;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const pools = BABY_FAMILIES.map((f) => BABY_THEMES.filter((t) => t.family === f).sort(() => rnd() - 0.5)).sort(() => rnd() - 0.5);
  const out: BabyTheme[] = [];
  for (let round = 0; out.length < Math.min(count, BABY_THEMES.length); round++) for (const p of pools) if (p[round] && out.length < count) out.push(p[round]);
  return out;
}

/** Planning figure only, from PocketShoot's observed usage at standard quality. Not a quote. */
export const BABY_EST_INR = 3;

export const BABY_EXAMPLE_FOLDER = "baby/themes";
