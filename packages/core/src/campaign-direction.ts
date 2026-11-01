import {compatibleApproaches} from "./photographic-direction";
import type {ProductAnalysis,ShotDirection} from "./director";
import type {CategoryLook} from "./product-looks";
export const COMMISSION_VERSION="2026-11-02.visual-commission-3";
export type CampaignRole="catalogue"|"wearable"|"graphic"|"context"|"detail"|"human-detail";
export interface VisualCommission {
 version:string;role:CampaignRole;paletteHue?:number;paletteName?:string;humanDirection?:string;environment:"studio"|"indoor"|"outdoor";
 light:"client-directed"|"white-diffusion"|"hard-shaped"|"selective-low-key"|"soft-sculpted"|"edge-transmitted";
 composition:"client-directed"|"isolated-readable"|"sculptural-diagonal"|"graphic-negative-space"|"near-far"|"gesture-led"|"product-body-crop"|"tactile-crop"|"spatial-layers";
 tone:"client-directed"|"white"|"deep-tonal"|"colour-block"|"natural-contrast";
 presentation:"catalogue-support"|"concealed-support"|"human-contact";
 focus:"whole-product"|"product-plane"|"material-plane";
}
const lessons:Record<string,string>={
 jewellery:"References 1,5,8–14,53–60: directed shoulder/hand/collarbone geometry; selective light makes the real metal and stone cuts luminous against controlled dark or tonal fields. Separate skin, metal and velvet physically. A close wearable frame may crop eyes or forehead; it need not become another smiling headshot. A display form is a deliberate material/shape choice, never the automatic beige retail bust.",
 footwear:"References 15–20: make stance, leg geometry, lace rhythm and negative space an original graphic idea; contrast rubber, suede, leather and fabric. Camera perspective and actual contact sell the shoe. A labelled sole requires that real reference. Do not imitate the branded boxes, chair or hybrid branding.",
 fashion:"References 61–90: choose a specific phase of a turn, seated release, step or intimate textile gesture. Keep motif placement, embroidery and real drape. Modern panelled space, hard-shaped studio light or landscape depth can be as relevant as heritage architecture; never default all Indian clothing to a palace or a beauty portrait.",
 beauty:"References 21–26,30–42,48–51: sculpt the actual glass, closure and label with flags, transmission and calibrated reflection bands. Build a visual argument from an evidenced ingredient, real formula texture, packaging geometry or buyer task. Amber is not honey, vitamin C is not orange, scent is not food. Human contact requires real supported use.",
 food:"References 27–29,43–47,52: turn an evidenced flavour, real serving texture or consumption moment into graphic rhythm, appetite and directional light. Only verified contents permit pours or cross-sections. Deliberate ingredient geometry can be quiet or dynamic; a tabletop with randomly scattered fruit is not the default.",
 other:"Make the visible design, actual material response and buyer task the idea. Develop one physical compositional relationship and an original colour/light argument. Do not substitute generic marble, linen, greenery or a retail podium for a concept."
};
export function referenceLessons(a:ProductAnalysis|null|undefined,collection?:string){
 return lessons[collection==="footwear"?"footwear":a?.category??"other"]??lessons.other;
}
/** Commission observable visual decisions; the actual place, palette and story remain open-ended. */
export function commissionFor(input:{analysis:ProductAnalysis|null;look:Pick<CategoryLook,"human"|"environment"|"framing">&{directionRole?:CampaignRole;collection?:string};edition:number;slot:number;previous?:ShotDirection[];siblings?:VisualCommission[];customerNotes?:string|null;palette?:string[]}):VisualCommission{
 const {look,edition,slot}=input;
 const role=look.directionRole??(look.framing==="close"?"detail":look.environment==="studio"?"catalogue":look.human!=="none"?"wearable":look.environment==="outdoor"?"context":"graphic");
 const studio=look.environment==="studio";
 const crop=role==="detail"||role==="human-detail";
 const human=look.human!=="none";
 const base:VisualCommission={version:COMMISSION_VERSION,role,environment:look.environment,
 light:studio?"white-diffusion":look.environment==="outdoor"?(edition%2?"hard-shaped":"soft-sculpted"):role==="human-detail"?"selective-low-key":role==="wearable"?"hard-shaped":"selective-low-key",
 composition:studio?(crop?"tactile-crop":"isolated-readable"):role==="human-detail"?"product-body-crop":human?"gesture-led":role==="graphic"?(edition%2?"sculptural-diagonal":"graphic-negative-space"):(edition%2?"near-far":"spatial-layers"),
 tone:studio?"white":look.environment==="outdoor"?"natural-contrast":edition%3===0?"colour-block":"deep-tonal",
 presentation:human?"human-contact":studio?"catalogue-support":"concealed-support",
 focus:crop?"material-plane":human?"product-plane":"whole-product"};
 if(!studio&&(input.customerNotes?.trim()||input.palette?.length))return {...base,light:"client-directed",composition:"client-directed",tone:"client-directed"};
 if(human&&!studio){
  const collection=look.collection??"";const jewelleryPortrait=/necklace|earring/.test(collection)||(!collection&&input.analysis?.category==="jewellery"&&/necklace|choker|earring/i.test(input.analysis.name));
  const necklacePoses=["Sculptural shoulder diagonal, chin gently raised and hand at temple; camera slightly below eye level. Both actual earrings and necklace stay visible. No hand resting at neck, collarbone or earring.","Seated forward with forearms supported below frame, shoulders at unequal heights and gaze off-camera. Face and full real set remain visible. No hand resting at neck, collarbone or earring.","One forearm creates a diagonal above the forehead, eyes look beyond it, shoulders relaxed. Keep the full real set unobstructed. No hand resting at neck, collarbone or earring."];
  base.humanDirection=jewelleryPortrait&&look.human==="model"?(role==="human-detail"?"Crop the upper face. Create asymmetric shoulder and collarbone geometry with hands outside the product plane; show the necklace and both earrings. No familiar hand-at-neck gesture.":necklacePoses[(edition+slot)%necklacePoses.length]):collection==="footwear"?"Direct believable leg/foot geometry and real shoe contact; keep the actual shoe the optical hero. The face may stay outside frame. Keep unknown sole/rear surfaces concealed.":input.analysis?.category==="fashion"?"Choose a readable phase of a step, seated release or small front-facing turn. Create asymmetric body geometry while keeping the real garment design fully legible and unknown backs hidden.":"Direct a specific product-relevant grip or body contact at true scale. Keep the product the optical hero; include a face only when it serves the actual product and selected human contract.";
 }
 if(!studio){
  const recent=(input.previous??[]).slice(0,12);const warm=recent.filter(s=>/ochre|terracotta|sandstone|beige|warm stone|warm brown/i.test(s.scene+" "+s.artDirection?.styling)).length>recent.length/2;
  let hue=look.environment==="outdoor"?110+((edition*47+slot*31)%110):(edition*137.508+slot*71)%360;
  if(warm&&hue<180)hue=190+(hue%110);
  base.paletteHue=Math.round(hue);base.paletteName=["crimson red","burnt orange","saffron amber","leaf green","jade green","deep teal","cyan blue","cobalt blue","blue violet","aubergine violet","berry magenta","rose red"][Math.round(hue/30)%12];
 }
 const previous=(input.previous??[]).map(s=>s.artDirection?.commission).filter((v):v is VisualCommission=>!!v&&v.role===role);
 // Rotate actual light/composition families, not only props or a different adjective.
 const lights:VisualCommission["light"][]=studio?["white-diffusion","soft-sculpted"]:look.environment==="outdoor"?["hard-shaped","soft-sculpted","edge-transmitted"]:["hard-shaped","selective-low-key","soft-sculpted","edge-transmitted"];
 for(let n=0;n<lights.length;n++){const light=lights[(edition+(role==="human-detail"?1:role==="wearable"?0:slot)+n)%lights.length];const candidate={...base,light};
  if(!previous.slice(0,2).some(p=>p.light===light&&p.composition===candidate.composition&&p.tone===candidate.tone)&&!input.siblings?.some(p=>p.role===role&&p.composition===candidate.composition&&p.light===light))return candidate;
 }
 return base;
}
const lightWords:Record<VisualCommission["light"],string>={
 "client-directed":"Honor explicit customer lighting/palette instructions, then use product-specific material shaping and natural shadow logic.",
 "white-diffusion":"A genuine seamless-white catalogue exposure: broad controlled diffusion, clean retained texture and believable contact. Do not introduce a room, coloured backdrop or dramatic darkness.",
 "hard-shaped":"One shaped, directional key with a clearly legible shadow boundary and deliberate negative fill; retained shadow texture. This must visibly differ from flat warm window light.",
 "selective-low-key":"Selective light isolates the actual product and a chosen body/material plane. Most of the backdrop stays deliberately deep; controlled falloff, negative fill and restrained highlights. Do not light the whole scene as a bright beige room.",
 "soft-sculpted":"A large close directional key with meaningful modelling and negative fill, distinct material gradients and retained fine texture; no flat beauty fill or uniform airbrushing.",
 "edge-transmitted":"Motivated edge/transmitted light separates the observed silhouette or translucent material; restrained front fill keeps the actual product readable. No glowing CGI edges or invented translucent contents."
};
const compWords:Record<VisualCommission["composition"],string>={
 "client-directed":"Honor the customer’s explicit composition and scene requests; develop a product-specific photographic idea within those requirements.",
 "isolated-readable":"A deliberate product hierarchy and clean, precise spacing; known full merchandise stays readable.",
 "sculptural-diagonal":"Use an authored diagonal/curve relationship and physically supported depth. Conceal every unobserved surface or attachment.",
 "graphic-negative-space":"Make one bold silhouette/negative-space relationship do the work. Original asymmetric spacing and colour geometry, not a centred product on a plinth.",
 "near-far":"Deliberate close/far scale and camera height create depth. Actual merchandise proportions stay intact; no stretching the product.",
 "gesture-led":"Direct a specific shoulder/hand/body geometry and an unforced in-between expression. The product is the focal subject; no default front-facing beauty headshot.",
 "product-body-crop":"An intimate product-on-body composition. Crop away the upper face/head when useful and let real skin, collarbone, wrist, ear or fabric establish scale. Show the requested actual merchandise; this is not another head-and-shoulders portrait.",
 "tactile-crop":"Crop through actual product boundaries onto a resolved material/design feature. Do not invent microscopic texture to simulate detail.",
 "spatial-layers":"Use motivated near, subject and far planes to construct a new original spatial story; no stock courtyard/table replacement."
};
export function commissionPrompt(c:VisualCommission){
 return "AUTHORITATIVE PHOTOGRAPHIC COMMISSION "+JSON.stringify(c)+". "+lightWords[c.light]+" "+compWords[c.composition]+
 (c.humanDirection?" HUMAN GEOMETRY TARGET: "+c.humanDirection+" This body geometry is a deliverable requirement; wardrobe or a new backdrop alone is insufficient. ":"")+
 (c.paletteName?" BACKGROUND COLOUR TARGET: "+c.paletteName+" family (approximate hue "+c.paletteHue+" degrees), expressed through actual backdrop/space/material planes; retain natural skin and exact product colour. This is a visible palette requirement, not a coloured light wash on the product. For outdoor use a credible real exterior palette with natural light; never repaint the sky or make a fake studio outdoors. Mention this palette by name in scene or styling. Do not revert to the recent warm-brown/gold room or beige sandstone garden. ":"")+
 (c.tone==="deep-tonal"?" TONAL TARGET: a deliberately deep background with controlled subject separation; invent a product-specific palette rather than beige/cream retail styling.":c.tone==="colour-block"?" TONAL TARGET: an original, deliberate colour-field relationship to actual merchandise, clear graphic separation and restrained props.":c.tone==="natural-contrast"?" TONAL TARGET: outdoor environmental contrast with real spatial cues and true product colour; avoid the automatic warm-stone garden setup.":"")+
 (c.presentation==="concealed-support"?" DISPLAY TARGET: no visible retail neck/bust form or retail earring peg stand, including fabric-covered forms. No default stone podium. Invent a physical arrangement that keeps unknown construction concealed. A hidden neutral support is permitted.":"")+
 " The major light, composition, tone and human direction above are deliverable requirements. The model may invent a fresh compatible setting and incidental props. Those props are not required inventory. Anatomy, exact merchandise, customer environment and source-supported geometry take priority.";
}

export function campaignPlanningPrompt(a:ProductAnalysis|null,human:string,crop:boolean,environment:string){
 return "Return artDirection: one original product idea with actual fact_ids, a concrete product_role, precise light_design, camera_design, styling, gesture and finish. Keep each string under 16 words. Choose a mechanism from "+JSON.stringify(compatibleApproaches(a,human,crop,environment).map(p=>p.id))+". The commissioned major visual treatment is authoritative; these mechanism names do not prescribe locations. ingredient_props may cite only exact label-grounded ingredient/flavour facts. Invent the actual scene from the observed product; no automatic beige bust, warm living room, flowers or stone tabletop. Never expose an unknown rear, closure, sole or interior. Preserve true merchandise and resolved detail.";
}

/** Auto-picked packs select a purpose, not the catalogue’s incidental surface/wardrobe recipe. */
export function campaignIntent(look:Pick<CategoryLook,"title"|"human"|"environment"|"framing">,role?:CampaignRole){
 const purposes:Record<CampaignRole,string>={catalogue:"A precise white-background catalogue photograph of the actual merchandise",wearable:"An original wearable/use editorial with a specific adult gesture, a product-appropriate field of view, and actual merchandise contact",graphic:"An original graphic product composition built from observed silhouette, geometry or material response",context:"An original genuinely outdoor story built from actual product/buyer context and spatial depth",detail:"An intentional crop onto a real resolved material or design feature","human-detail":"An intimate product-on-body composition distinct from the wearable portrait; upper face cropped, all full-contract merchandise still visible"};
 return (role?purposes[role]:"Selected experience: "+look.title)+". Contract: "+JSON.stringify({human:look.human,environment:look.environment,framing:look.framing})+". Invent the setting, palette and physical arrangement from the observed product. Full means all actual merchandise; concealed supports may hide unknown construction.";
}
