/**
 * Baby Shoot theme cards (newborn, birth to about 10 weeks).
 * Written from the founder's reference study. Each card is a description of a studio set,
 * never a copy of a specific photograph. No characters, brands or lettering.
 */
export type BabyFamily = "Classic" | "Minimal" | "Floral" | "Fine art" | "Sky" | "Playful" | "Indian";
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
  T("pink-crate", "Little bed", "Minimal", "Whitewashed crate, rose tones", ["#e2b3b8", "#b77a86"], "a small whitewashed wooden crate bed set on a diagonal, lined with curly cream wool, on a plain dusty-rose backdrop, with a length of rose muslin trailing out of the crate", "a rose knit wrap around the whole body, a fine mohair bonnet in the same rose, a tiny knitted teddy under the hands", "swaddled on the back in the crate", "overhead"),
  T("flower-nest", "Flower nest", "Floral", "Wreath of pastel flowers", ["#eee4dc", "#b9a5c4"], "a round woven nest filled with cream wool, ringed by a full wreath of muted pastel flowers (dusty lilac, pale blue, ivory, eucalyptus), on a soft plaster-textured cream backdrop with generous empty space", "a white wrap around the body and hips with arms and feet free, a small white bow headband", "lying on the back in the middle of the nest", "overhead"),
  T("rose-heart", "Rose heart", "Floral", "Heart bowl filled with roses", ["#f1d5cf", "#d77f86"], "a carved heart-shaped wooden bowl packed around the edges with fresh pink and peach roses and tiny white filler flowers, on a warm cream plaster backdrop", "a pale-pink mohair wrap around the whole body, a pink headband with small flowers", "swaddled on the back among the roses", "overhead"),
  T("dark-crate", "Autumn crate", "Fine art", "Moody browns, tweed knit", ["#7a5a3e", "#2f2118"], "a small dark wooden crate on worn dark floorboards with a brown wool layer, deep brown shadows all around", "a multi-tone brown and teal tweed-knit wrap around the whole body with a matching knit bonnet tied under the chin", "wrapped upright in the crate with the head tilted on the hands", "close", "lowkey"),
  T("stump", "Woodland", "Fine art", "Tree stump, wild flowers", ["#5b4a3a", "#8fa07a"], "a short tree stump topped with a cream wool layer, wrapped at its base with trailing greenery and small lilac, blue and white wild flowers, on dark wooden floorboards fading to black", "an ivory wrap over the back and hips, arms bare, a slim headband with a small flower", "lying on the tummy on top of the stump with the cheek resting on folded arms", "eye", "lowkey"),
  T("krishna", "Little Krishna", "Indian", "Peacock feather and flute", ["#f3efe6", "#c9a24a"], "soft white fur with two peacock feathers laid in the background and a small decorated wooden flute beside the baby", "a white wrap with a woven gold border laid diagonally across it, a thin gold cord headband with a string of small pearls and a single short peacock feather", "swaddled on the back, one hand resting by the cheek", "overhead"),
  T("shiva", "Shiv bhakt", "Indian", "Saffron, rudraksha, mountains", ["#e8862a", "#3d5a80"], "an ivory textured blanket in the foreground and a painted backdrop of blue Himalayan peaks behind, a small brass trishul standing to one side and a small damru drum in front", "a plain saffron cotton cloth wrapped around the whole body with no printing or lettering on it, a string of rudraksha beads over the wrap, a small sandalwood tilak on the forehead", "wrapped upright in the potato-sack pose, face level with the camera", "eye"),
  T("scale", "Weighing scale", "Classic", "Antique scale, soft linen", ["#d8cfc0", "#8f7a5a"], "an antique brass grocer's scale with its shallow pan lined with cream wool and linen, standing on a worn pale wooden table against a plain plaster wall", "an oatmeal cheesecloth wrap around the whole body", "swaddled on the back in the scale pan, fully supported by the padding", "eye"),
  T("dough-bowl", "Dough bowl", "Classic", "Long wooden trough, linen", ["#e4d8c4", "#9a7a52"], "a long hand-carved wooden dough trough lined with rumpled natural linen, on wide pale floorboards, a sprig of olive leaves beside it", "a stone-coloured jersey wrap around the whole body with fingers peeking out", "swaddled on the back along the length of the trough", "overhead"),
  T("moses", "Moses basket", "Classic", "Palm-leaf basket, white cotton", ["#f1ece2", "#c9b48a"], "a woven palm-leaf Moses basket with a white cotton lining and a quilted cotton pad, on a white-washed wooden floor in soft window light", "a white cotton muslin wrap around the whole body, a fine white cotton bonnet", "swaddled on the back in the basket", "overhead"),
  T("feather-arc", "Feather", "Minimal", "White feathers, soft grey", ["#ecebe6", "#b9b5ac"], "a plain warm-grey backdrop with a single loose arc of long white ostrich feathers curving above the baby's head, and lots of empty space", "an ivory wrap around the whole body", "swaddled on the back on a thin cream wool layer, small in the frame", "overhead"),
  T("rust-fox", "Rust", "Minimal", "Rust knit and a tiny fox", ["#e3a989", "#a8502c"], "a rust-coloured curly wool rug filling the frame, softly out of focus in front and behind", "a rust knit wrap around the whole body, a matching pointed pixie bonnet tied under the chin, a tiny hand-knitted fox tucked by the hands", "wrapped upright in the potato-sack pose, chin resting on the hands", "eye"),
  T("linen", "Linen", "Minimal", "Washed linen, window light", ["#e9e2d6", "#bfb39e"], "a bed of rumpled washed oat-coloured linen sheets with nothing else in frame", "oat-coloured knit bloomers and a matching fine-knit bonnet, with a light linen layer over the hips and legs", "lying on the back with arms relaxed and hands near the face", "close"),
  T("charcoal", "Charcoal", "Minimal", "Charcoal rib knit", ["#6b6b70", "#2f2f33"], "a charcoal-grey chunky ribbed knit blanket filling the frame", "a lighter grey jersey wrap around the whole body, a tiny hand-knitted grey star tucked by the hands", "swaddled on the back on a slight diagonal", "overhead"),
  T("terracotta", "Terracotta", "Minimal", "Clay tones, hand-made pots", ["#d99a7a", "#a85a3c"], "a clay-dyed muslin backdrop in soft terracotta with two small unglazed hand-made clay pots at the top edge of the frame", "a terracotta cheesecloth wrap around the whole body", "swaddled on the back on a thin wool layer in the same clay tone", "overhead"),
  T("delphinium", "Blue garden", "Floral", "Blue flowers, grey stone", ["#b7c9e6", "#4a6aa8"], "a shallow hand-thrown ceramic bowl in pale grey-blue lined with soft wool, on a stone-grey linen floor, with loose stems of blue delphinium and cornflower laid along one side only", "a dusty-blue open-knit wrap around the whole body with hands under the chin", "swaddled on the back in the bowl", "overhead"),
  T("window-frame", "Window", "Floral", "Old window frame, jasmine", ["#dfe6d6", "#8aa07a"], "a weathered white-painted wooden window frame lying flat on washed sage linen, a few strands of fresh jasmine and ivy trailing over one corner", "a soft ivory jersey wrap around the whole body with hands and toes peeking out", "swaddled on the back inside the frame", "overhead"),
  T("petal-ring", "Petal ring", "Floral", "Rings of real petals", ["#f0c9c9", "#c4566a"], "three loose concentric rings of real rose petals laid by hand on a warm ivory linen floor, shading from deep rose at the outside to pale blush at the centre", "a blush cheesecloth wrap around the whole body", "swaddled on the back at the centre of the rings", "overhead"),
  T("sunflower-tray", "Sunflower", "Floral", "Sunflowers, warm ochre", ["#f3c552", "#c98a1c"], "a round wicker tray lined with mustard wool on ochre linen, a small galvanised bucket of sunflowers standing at the top corner of the frame and a few loose petals fallen on the linen", "a mustard jersey wrap wound around the torso and hips with arms and feet free", "curled on the side in the tray with knees tucked up and hands by the face", "overhead"),
  T("lavender", "Lavender", "Floral", "Dried lavender, weathered wood", ["#cfc3e0", "#7a6aa8"], "a weathered grey wooden crate lined with lilac muslin, with three hand-tied bundles of dried lavender laid beside it on old grey floorboards", "a lilac cheesecloth wrap around the whole body", "swaddled on the back in the crate", "overhead"),
  T("marigold", "Genda phool", "Floral", "Marigold garlands", ["#f2a52a", "#d9641e"], "two real marigold garlands laid in a loose oval on a saffron-yellow cotton cloth, with a few loose marigold heads and green mango leaves at one side", "a soft yellow cotton wrap around the whole body", "swaddled on the back inside the oval of garlands", "overhead"),
  T("jasmine", "Mogra", "Floral", "Jasmine strings, banana leaf", ["#f4f1e6", "#5a8a4a"], "a fresh green banana leaf laid on a white cotton cloth, with strings of jasmine buds curved loosely around its edge", "a white cotton muslin wrap around the whole body", "swaddled on the back on the banana leaf over a thin cotton pad", "overhead"),
  T("lotus", "Lotus", "Floral", "Pink lotus, soft green", ["#f1c6d0", "#7fa37a"], "a shallow round wooden bowl lined with pale green wool on a sage-green linen floor, with three pink lotus blooms and two round lotus leaves arranged to one side", "a pale pink jersey wrap around the whole body", "swaddled on the back in the bowl", "overhead"),
  T("bronze-fern", "Bronze fern", "Fine art", "Deep teal, dried fern", ["#1f4a4f", "#b08a4a"], "a low dark basket lined with charcoal wool on a near-black backdrop, with a loose half-wreath of dried bronze fern, eucalyptus and pampas curving around one side", "a deep teal wrap around the body and hips with the hands free, a teal knit sleepy hat", "swaddled on the back in the basket", "overhead", "lowkey"),
  T("black", "Noir", "Fine art", "Black on black", ["#3a3a40", "#0f0f12"], "a matte black wool backdrop with nothing else in frame, the face and the top of the wrap softly lit so the weave of the black fabric is clearly visible", "a black cheesecloth wrap around the whole body", "swaddled on the back on a slight diagonal", "overhead", "lowkey"),
  T("old-master", "Still life", "Fine art", "Velvet, pewter, one window", ["#5a3b2a", "#1f1712"], "a dark umber scene like an old Dutch still-life painting: a draped brown velvet cloth on a worn wooden table, with a dull pewter jug and a halved pomegranate at one side", "an ivory linen wrap around the whole body", "swaddled on the back on the velvet with the head toward the light", "close", "lowkey"),
  T("mono", "Black and white", "Fine art", "A true monochrome portrait", ["#bdbdbd", "#3a3a3a"], "a plain soft-grey backdrop with a single layer of cheesecloth, made as a true black-and-white photograph with rich greys and gentle film grain", "a pale cheesecloth wrap around the whole body", "swaddled on the back, face turned slightly toward the light", "close"),
  T("paper-stars", "Starry night", "Sky", "Midnight velvet, paper stars", ["#1a2140", "#c9a94a"], "a midnight-blue cotton velvet backdrop with hand-cut gold paper stars of different sizes scattered unevenly and a small hand-cut paper moon in one corner", "an ivory wrap around the whole body, a soft ivory knit beanie", "swaddled on the back among the stars", "overhead"),
  T("paper-moon", "Crescent moon", "Sky", "Wooden moon, wool clouds", ["#27304f", "#e8e2d0"], "a crescent-moon shaped wooden bed with a hand-painted matte gold finish, padded with carded white wool like a cloud, a few small wooden stars hanging on plain thread behind it, on a pale grey muslin backdrop", "an ivory wrap around the whole body", "swaddled and resting in the curve of the moon", "eye"),
  T("sunrise", "Sunrise", "Sky", "Paper sun, peach sky", ["#f7c9a8", "#e88a5a"], "a peach cotton backdrop with a hand-cut layered paper sun rising from the bottom edge in coral and apricot, and two small carded-wool clouds", "an apricot jersey wrap around the whole body", "swaddled on the back just above the paper sun", "overhead"),
  T("balloon", "Hot-air balloon", "Sky", "Flat-lay balloon, wool clouds", ["#cfe0ea", "#e0a87a"], "a flat-lay scene on a pale sky-blue cotton backdrop: a small round wicker basket with a balloon canopy shaped from gathered striped cotton above it, joined by four lengths of twine, with carded-wool clouds around", "a cream wrap around the whole body", "swaddled on the back in the wicker basket, as if riding in the balloon", "overhead"),
  T("bakery", "Little baker", "Playful", "Flour, dough and a rolling pin", ["#d9b98c", "#8a5a33"], "a floured wooden baking board on a warm brown linen backdrop, with a small wooden rolling pin, three balls of raw dough, a scatter of flour and a little enamel sieve", "an unbleached cheesecloth wrap around the whole body, a tiny cream cotton baker's cap", "swaddled on the back on a folded linen tea towel at the centre of the board", "overhead"),
  T("teddy", "Teddy", "Playful", "Old teddy, cream quilt", ["#eadfce", "#b08a5a"], "a hand-stitched cream cotton quilt with a well-loved honey-coloured mohair teddy bear lying beside the baby", "an oatmeal knitted romper with wooden buttons and a matching bonnet with small round ears", "lying on the back beside the teddy, one arm relaxed out to the side", "overhead"),
  T("chai", "Chai time", "Playful", "Brass kettle and kulhads", ["#c99a6a", "#7a4a2a"], "a worn wooden tray on a jute mat with a small brass kettle, three clay kulhad cups, a few green cardamom pods and a cinnamon stick, on a warm tea-brown backdrop", "a tea-coloured cheesecloth wrap around the whole body", "swaddled on the back beside the tray on a folded cotton cloth", "overhead"),
  T("cricket", "Little cricketer", "Playful", "Bat, red ball, cable knit", ["#e8e4d6", "#3f7a4a"], "a strip of green felt like a pitch on a cream cotton backdrop, with a small plain wooden cricket bat, a red leather cricket ball and a set of miniature wooden stumps beside the baby", "a cream cable-knit wrap around the whole body with a thin navy stripe at the edge, a small cream knit cap", "swaddled on the back beside the bat", "overhead"),
  T("kites", "Kite day", "Playful", "Paper kites and a spool", ["#bfe0f0", "#e85a7a"], "a sky-blue cotton backdrop with four hand-made diamond paper kites in pink, yellow, orange and green laid at different angles, their thread leading to a wooden spool beside the baby", "a white cotton wrap around the whole body", "swaddled on the back with the spool near the hands", "overhead"),
  T("artist", "Little artist", "Playful", "Palette, brushes, linen", ["#e6dccb", "#c97a5a"], "an unprimed linen canvas cloth as the floor, with a small wooden palette carrying dabs of real oil paint, three used brushes and a tiny table easel holding a blank canvas", "a natural linen wrap around the whole body with one small smudge of ochre paint on the cloth, a soft grey knit cap", "swaddled on the back beside the palette", "overhead"),
  T("laundry", "Laundry day", "Playful", "Tiny socks on a line", ["#e3ecef", "#9ab6c4"], "a pale blue-grey cotton backdrop with a length of twine pinned across the top holding three pairs of tiny knitted socks on wooden pegs, and a small wicker laundry basket lined with white cotton", "a white waffle-cotton wrap around the whole body", "swaddled on the back in the wicker basket", "overhead"),
  T("gardener", "Little gardener", "Playful", "Clay pots and seedlings", ["#cfd8b8", "#7a8a4a"], "a potting-bench scene laid flat on a moss-green linen backdrop: small terracotta pots, a few green seedlings in soil, a tiny galvanised watering can and a wooden trowel", "an olive cheesecloth wrap around the whole body, a small natural straw sun hat", "swaddled on the back on a folded hessian sack among the pots", "overhead"),
  T("monsoon", "Monsoon", "Playful", "Paper boats, felt raindrops", ["#b9c9d6", "#f0c23a"], "a blue-grey cotton backdrop with a grey carded-wool cloud at the top, a few hand-cut felt raindrops below it and three folded white paper boats near the bottom", "a yellow jersey wrap around the whole body like a little raincoat, a matching yellow knit cap", "swaddled on the back beneath the cloud", "overhead"),
  T("mor-pankh", "Mor pankh", "Indian", "Peacock feathers on teal silk", ["#0f5f5c", "#2c7fb8"], "a length of deep teal raw silk with soft folds, five real peacock feathers laid in a loose crescent along one side and a small brass bell near the corner", "a deep green open-knit wrap around the whole body", "swaddled on the back on the silk", "overhead", "lowkey"),
  T("tiranga-petals", "Tiranga", "Indian", "Marigold, jasmine and tulsi", ["#f08a24", "#1f7a3d"], "a hand-spun white khadi cloth as the floor, with three broad horizontal bands laid across it by hand: orange marigold petals at the top, white jasmine buds in the middle and fresh green tulsi leaves at the bottom", "a plain white khadi wrap around the whole body", "swaddled on the back across the white middle band", "overhead"),
  T("silk-chowki", "Festive silk", "Indian", "Silk, brass and a low stool", ["#b3261e", "#c9a24a"], "a low carved wooden chowki stool with a folded cream cushion on a deep maroon mottled backdrop, and a brass urli bowl with floating flower petals at the edge of the frame", "a red silk cloth with small woven gold motifs wrapped around the whole body, a green silk border folded across the chest, a tiny red bindi", "wrapped upright on the cushion in the potato-sack pose", "eye", "lowkey"),
  T("pookalam", "Pookalam", "Indian", "Flower rangoli", ["#f0b24a", "#c4466a"], "a hand-laid floral rangoli of concentric rings on a dark polished stone floor, in marigold orange, chrysanthemum yellow, rose pink and green leaf, with a clear plain circle at the centre lined with cream cotton", "a cream cotton wrap with a narrow woven gold border around the whole body", "swaddled on the back in the clear centre of the rangoli", "overhead"),
  T("diwali", "Diwali", "Indian", "Diyas, marigold, deep silk", ["#7a1f3a", "#e8a83a"], "a deep maroon raw-silk cloth as the floor, a row of small unlit clay diyas along the top edge of the frame well away from the baby, and loose marigold petals with a small brass plate of flowers at one side", "a gold-beige silk-cotton wrap around the whole body with a thin maroon border", "swaddled on the back on a cream cushion", "overhead", "lowkey"),
  T("holi", "Holi", "Indian", "Bowls of colour, white cotton", ["#f4f1ec", "#e86aa0"], "a white cotton backdrop with five small brass bowls of gulal powder in pink, yellow, green, blue and orange arranged in an arc at the top, and a light dusting of colour on the cloth near the bowls only", "a plain white cotton wrap around the whole body, kept perfectly clean", "swaddled on the back below the arc of bowls", "overhead"),
  T("harvest", "Harvest", "Indian", "Wheat sheaves, mustard yellow", ["#e8c86a", "#b08a3a"], "a mustard-yellow cotton backdrop with two small hand-tied sheaves of golden wheat crossed at one side and a few sprigs of yellow mustard flowers", "a wheat-coloured cheesecloth wrap around the whole body", "swaddled on the back on a thin jute mat", "overhead"),
  T("pashmina", "Pashmina", "Indian", "Embroidered shawl, walnut wood", ["#c9b08a", "#7a3a2a"], "a carved walnut-wood tray lined with cream wool on a soft beige wool backdrop, with a fine pashmina shawl carrying a hand-embroidered paisley border in muted rust and green draped loosely beside it", "a cream wool wrap around the whole body with the embroidered shawl border laid across the chest", "swaddled on the back in the tray", "overhead"),
  T("chand", "Chand raat", "Indian", "Lantern, emerald velvet", ["#1f5a4a", "#c9a24a"], "an emerald-green cotton velvet cloth as the floor, a small brass lantern with a cut-work pattern standing unlit at one corner and a thin hand-cut brass crescent beside it, the backdrop falling to deep green shadow", "an ivory wrap with a fine gold thread border around the whole body", "swaddled on the back on a cream cushion", "overhead", "lowkey"),
  T("thoran", "Thoran", "Indian", "Mango leaves, brass lamp", ["#efe6cf", "#4a7a3a"], "a cream cotton backdrop with a string of fresh mango leaves hung across the top like a doorway thoran, an unlit brass lamp standing at one side and a small heap of jasmine at its base", "a cream cotton wrap with a woven gold border around the whole body", "swaddled on the back on a woven grass mat beneath the leaves", "overhead"),
];

export const BABY_FAMILIES: BabyFamily[] = ["Classic", "Minimal", "Floral", "Fine art", "Sky", "Playful", "Indian"];
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

const LOOK = "Look: a real photograph taken in a newborn studio on a full-frame camera, lightly retouched at most. True-to-life colour and gentle contrast, with a little natural sensor grain. Real newborn skin: slightly uneven tone, faint redness and mottling, a few tiny milk spots, fine peach fuzz, dry flaky skin in the creases and soft folds; never airbrushed, waxy, glossy or glowing. Real materials behaving naturally: fabric with small wrinkles and a loose thread, wool with stray fibres, wood with grain and wear, flowers and leaves with small imperfections. Every prop sits with real weight and a soft contact shadow. Styled by hand, so slightly imperfect and never mirror-symmetrical. No sparkle or glitter effects, no glow, no lens flare, no shaped bokeh, no HDR look, no painterly, illustrated or 3D-rendered finish. One colour family across wrap, props and backdrop, with at most one accent.";
const ALWAYS = "Always: the hips and nappy area are fully covered by the wrap or outfit. One baby only, no adults or hands in frame. No text, letters, numbers, logos, brand names, watermarks or borders anywhere.";
/** Different moments, so a shoot is the same baby at different times and not one face repeated. */
const MOMENTS: Record<BabyState, string[]> = {
  asleep: [
    "The baby is peacefully asleep: eyes closed, lips together, face fully relaxed, head straight.",
    "The baby is asleep with eyes closed and the faintest sleepy smile, head turned slightly to one side.",
    "The baby is deeply asleep: eyes closed, lips slightly parted, head turned slightly to the other side.",
    "The baby is asleep with eyes closed, chin tucked a little and one cheek resting into the fabric.",
  ],
  awake: [
    "The baby is awake and calm: eyes open and looking straight into the camera, lips together.",
    "The baby is awake with eyes open, looking softly off to one side, mouth relaxed.",
    "The baby is awake with a small, natural hint of a smile, looking at the camera.",
    "The baby is caught in a small yawn, eyes squeezed nearly shut.",
  ],
};
export const BABY_MOMENTS = 4;
const KEEP_MOMENT = "Keep the baby's expression, gaze and eye state as they are in the reference photo.";
const scene = (theme: BabyTheme, momentLine: string) => [
  `Set: ${theme.set}.`,
  `Styling: ${theme.wear}.`,
  `Pose: ${theme.pose}. ${momentLine} The pose must be one a real newborn can safely hold, with the head and neck supported.`,
  CAMERA[theme.camera],
  LIGHT[theme.light],
  LOOK,
];

/**
 * One prompt per photo.
 * Identity (who the baby is) is kept. Capture conditions (light, lens, expression, marks on the upload) are re-made for the scene,
 * because copying them makes the face look pasted onto the set.
 */
export function babyPrompt(theme: BabyTheme, state: BabyState, references: number, moment = 0, keepExpression = false): string {
  return [
    `Create a new professional newborn studio photograph of the same baby shown in the reference photo${references > 1 ? "s" : ""}. This is a new photograph taken in a studio, not a cut-out of the reference placed into a scene.`,
    "Identity, keep exactly: who the baby is. Face shape, the shape and spacing of the eyes, eyebrows, nose, lips, cheeks and ears, true skin tone, birthmarks, hair colour, hairline and amount of hair. Do not beautify, slim, lighten or age the face.",
    "Re-capture, do not copy: the reference is a casual phone snapshot. Do not carry over its lighting, its close-up wide-angle distortion, its head angle, its clothing or accessories, its background, or any watermark, logo, text or mark printed over it. Light the face with the same light as the set, with matching shadow direction and softness, so face and scene belong together. Render the head as an 85mm portrait lens would, in true newborn proportion to the body. Skin is matte and natural: no gloss or shine on the eyelids or lips, nothing that reads as make-up.",
    ...scene(theme, keepExpression ? KEEP_MOMENT : MOMENTS[state][Math.abs(moment) % BABY_MOMENTS]),
    `${ALWAYS} Replace everything from the original background and clothing.`,
  ].join("\n");
}

/** The picture on a theme card: an invented baby, never a customer's child. */
export function babyExamplePrompt(theme: BabyTheme): string {
  return [
    "Create a professional newborn studio photograph of an invented baby who is not a real person: a healthy two-week-old Indian newborn with soft dark hair and true newborn proportions.",
    ...scene(theme, MOMENTS.asleep[0]),
    ALWAYS,
  ].join("\n");
}

/** Team testing only: an invented baby as an ordinary phone snapshot, to test with instead of a real child's photo. */
export const BABY_PHONE_TEST_PROMPT = "A casual, unposed phone snapshot, not a studio photo, of an invented baby who is not a real person: a healthy three-week-old Indian newborn with soft dark hair, awake with mouth slightly open, lying on a printed cotton bedsheet at home in a simple white cotton vest. Photographed from close above with a phone: flat indoor daylight, a little soft, slightly wide-angle. No text, no watermark.";

/** Spread a shoot across families so a batch feels like several setups, not one repeated. */
export function mixThemes(count: number, seed = Date.now()): BabyTheme[] {
  let s = seed % 2147483647 || 1;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const pools = BABY_FAMILIES.map((f) => BABY_THEMES.filter((t) => t.family === f).sort(() => rnd() - 0.5)).sort(() => rnd() - 0.5);
  const out: BabyTheme[] = [];
  for (let round = 0; out.length < Math.min(count, BABY_THEMES.length); round++) for (const p of pools) if (p[round] && out.length < count) out.push(p[round]);
  return out;
}

export const BABY_EXAMPLE_FOLDER = "baby/themes";

/** Names of earlier themes, so photos saved under them still show the right label. */
export const BABY_LEGACY_NAMES: Record<string, string> = { baker: "Little baker", "blue-bloom": "Blue bloom", "gold-frame": "Framed", "gold-palm": "Gold palm", "rose-bud": "Rose bud", wings: "Angel wings", peacock: "Peacock", tiranga: "Tiranga", silk: "Festive silk", sunflower: "Sunflower", noir: "Noir", "rust-beret": "Rust beret", bear: "Sleepy bear", stars: "Starry night", moon: "Crescent moon" };
