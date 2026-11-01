import type {VisualCommission} from "./campaign-direction";
import type {CategoryId} from "./categories";
import type {ProductAnalysis} from "./director";
export const FACT_KINDS=["identity","variant","flavour","ingredient","material","construction","finish","use"] as const;
export interface ProductFact {id:string;kind:typeof FACT_KINDS[number];value:string;source:"label"|"visible";evidence:string;reference:number}
export interface ProductIntelligence {facts:ProductFact[];buyer_job:string;distinctive_features:string[];uncertainties:string[]}
const text=(v:unknown,n=220)=>typeof v==="string"?v.replace(/[\u0000-\u001f]/g," ").trim().slice(0,n):"";
const norm=(v:string)=>v.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
export const INTELLIGENCE_SCHEMA={type:"object",additionalProperties:false,required:["facts","buyer_job","distinctive_features","uncertainties"],properties:{buyer_job:{type:"string"},distinctive_features:{type:"array",maxItems:5,items:{type:"string"}},uncertainties:{type:"array",maxItems:5,items:{type:"string"}},facts:{type:"array",maxItems:14,items:{type:"object",additionalProperties:false,required:["kind","value","source","evidence","reference"],properties:{kind:{type:"string",enum:[...FACT_KINDS]},value:{type:"string"},source:{type:"string",enum:["label","visible"]},evidence:{type:"string"},reference:{type:"integer",minimum:1,maximum:6}}}}}} as const;
export function parseIntelligence(raw:unknown,visibleText:string[]):ProductIntelligence|undefined{
 if(!raw||typeof raw!=="object")return;
 const r=raw as Record<string,unknown>,label=norm(visibleText.join(" "));
 const facts:ProductFact[]=[];
 for(const row of Array.isArray(r.facts)?r.facts.slice(0,14):[]){
  if(!row||typeof row!=="object")continue;const f=row as Record<string,unknown>;
  const kind=f.kind as ProductFact["kind"],value=text(f.value,100),evidence=text(f.evidence),source=f.source;
  if(!FACT_KINDS.includes(kind)||!value||!evidence||!["label","visible"].includes(String(source)))continue;
  if(source==="label"&&!label.includes(norm(evidence)))continue;
  // An ingredient/variant cannot be inferred from colour, a molecular benefit or decorative source props.
  if(["ingredient","flavour","variant"].includes(kind)&&(source!=="label"||!norm(evidence).includes(norm(value))))continue;
  facts.push({id:"f"+(facts.length+1),kind,value,source:source as ProductFact["source"],evidence,reference:Number.isInteger(f.reference)?Math.min(6,Math.max(1,Number(f.reference))):1});
 }
 const list=(v:unknown)=>Array.isArray(v)?v.map(x=>text(x)).filter(Boolean).slice(0,5):[];
 return {facts,buyer_job:text(r.buyer_job),distinctive_features:list(r.distinctive_features),uncertainties:list(r.uncertainties)};
}
export function groundedFacts(a:ProductAnalysis|null|undefined):ProductFact[]{
 if(a?.intelligence)return a.intelligence.facts;
 if(!a)return [];
 const label=norm(a.visible_text.join(" "));
 return [...a.materials.slice(0,4).map((value,i)=>({id:"material"+i,kind:"material" as const,value,source:"visible" as const,evidence:"Observed product material",reference:1})),...a.key_ingredients.filter(v=>label.includes(norm(v))).map((value,i)=>({id:"ingredient"+i,kind:"ingredient" as const,value,source:"label" as const,evidence:a.visible_text.find(t=>norm(t).includes(norm(value)))??value,reference:1}))];
}
export function productEvidencePrompt(a:ProductAnalysis|null|undefined,compact=false){return JSON.stringify({facts:compact?groundedFacts(a).map(({id,kind,value,source})=>({id,kind,value,source})):groundedFacts(a),use:a?.use_case,buyer_job:a?.intelligence?.buyer_job,distinctive_features:a?.intelligence?.distinctive_features,uncertainties:a?.intelligence?.uncertainties??a?.photo_issues,usage_confidence:a?.usage_confidence});}
export interface ArtDirection {commission?:VisualCommission;idea:string;fact_ids:string[];mechanism:string;product_role:string;light_design:string;camera_design:string;styling:string;gesture:string;finish:string;ingredient_props:{name:string;fact_id:string}[]}
export const ART_DIRECTION_SCHEMA={type:"object",additionalProperties:false,required:["idea","fact_ids","mechanism","product_role","light_design","camera_design","styling","gesture","finish","ingredient_props"],properties:{idea:{type:"string"},fact_ids:{type:"array",maxItems:3,items:{type:"string"}},mechanism:{type:"string"},product_role:{type:"string"},light_design:{type:"string"},camera_design:{type:"string"},styling:{type:"string"},gesture:{type:"string"},finish:{type:"string"},ingredient_props:{type:"array",maxItems:3,items:{type:"object",additionalProperties:false,required:["name","fact_id"],properties:{name:{type:"string"},fact_id:{type:"string"}}}}}} as const;
interface Approach {id:string;principle:string;categories?:CategoryId[];human?:boolean;close?:boolean;studio?:boolean;needsIngredients?:boolean}
/** Distilled photographic mechanisms, not locations or copies of supplied campaigns. */
export const PHOTOGRAPHIC_APPROACHES:Approach[]=[
 {id:"shadow-sculpture",principle:"Use a shaped hard key, controlled shadow edge and negative fill to reveal the actual silhouette; design shadow geometry, not a generic sunny room.",studio:true},
 {id:"tonal-material",principle:"Build a deliberate tonal relationship between the real material and set. Retain subtle differences in gloss, grain, translucency and edge roll-off.",studio:true},
 {id:"graphic-colour",principle:"Choose an original complementary or restrained analogous palette from actual packaging or fabric; give the product clear graphic hierarchy."},
 {id:"controlled-reflection",principle:"Treat the surface as a lighting instrument: a designed true reflection and flagged highlights; reflections are not duplicate merchandise.",categories:["beauty","jewellery","fashion","electronics","home_kitchen"],studio:true},
 {id:"edge-and-facet",principle:"Shape metal, faceted stones or glass with broad graduated reflections and a restrained harder accent. Preserve cut, settings and material colour.",categories:["jewellery","beauty","electronics"],studio:true},
 {id:"ingredient-geometry",principle:"Use only evidenced flavour/ingredient props as a graphic composition, varying scale, cut, spacing and colour relationship; do not merely scatter fruit around a centred pack.",categories:["food","beauty"],needsIngredients:true},
 {id:"frozen-material-motion",principle:"Design one purposeful suspended movement with coherent gravity, sharp contact/action and a consistent light direction. Liquid effects require evidence of actual contents; never fabricate a formula or open a sealed pack.",categories:["food","beauty" ]},
 {id:"tactile-detail",principle:"Choose a real resolved feature and a deliberate focus plane; show tactile material under raking light, not fake microscopic enhancement.",close:true,studio:true},
 {id:"editorial-gesture",principle:"Direct one specific relaxed adult gesture and natural expression around the product. Design visible contact, body tension, gaze and negative space; avoid the stock front-facing smile.",human:true},
 {id:"intimate-human-detail",principle:"Let hands, collarbone, ear, wrist or fabric establish scale and emotion in a product-focused crop. Natural skin microvariation, sensible joints and credible lens fall-off.",human:true,close:true},
 {id:"movement-and-drape",principle:"Choose a readable phase of a step, turn or seated fabric release. Gravity, hem, seam direction and motif placement must remain credible and unchanged.",categories:["fashion"],human:true},
 {id:"architectural-frame",principle:"Use real spatial layers, openings or foreground planes to organise the product and give motivated depth. Choose a place from its buyer context, not a stock palace."},
 {id:"ritual-and-use",principle:"Make the buyer's actual task the idea: define action, grip, moment and visible product role. Mechanics and scale must be supported by references.",human:true},
 {id:"near-far-editorial",principle:"Use a deliberate camera height and perspective to create near/far hierarchy while keeping the exact merchandise readable; do not stretch intrinsic proportions.",studio:true},
 {id:"authored-still-life",principle:"Arrange the real merchandise around one shape or material relationship. Every support, edge and gap serves that idea; reject generic decorative clutter.",studio:true},
];
export function compatibleApproaches(a:ProductAnalysis|null|undefined,human:string,crop:boolean,environment:string){
 const ingredients=groundedFacts(a).some(f=>["ingredient","flavour"].includes(f.kind)&&f.source==="label");
 return PHOTOGRAPHIC_APPROACHES.filter(p=>(!p.categories||p.categories.includes(a?.category??"other"))&&(!p.human||human!=="none")&&(!p.close||crop)&&(!p.needsIngredients||ingredients)&&(environment!=="studio"||p.studio));
}
export function photographyPlanningPrompt(a:ProductAnalysis|null|undefined,human:string,crop:boolean,environment:string,edition=0,slot=0){
 const options=compatibleApproaches(a,human,crop,environment);const start=(edition*3+slot)%options.length;
 const choices=Array.from({length:Math.min(4,options.length)},(_,n)=>options[(start+n)%options.length]);
 return "Choose one compatible photographic mechanism and invent a specific product-led idea. These are principles, NOT backdrop templates: "+JSON.stringify(choices)+". Return artDirection with the actual fact_ids that motivated the idea, an explicit product_role, light_design (key size/direction, fill/negative fill, highlight control), camera_design (appearance of lens/perspective, focal plane and depth), styling, adult gesture or none, and realistic finish. Keep each artDirection string under 16 words (light_design under 24 words); do not repeat the scene paragraph. ingredient_props may cite only a label-grounded flavour/ingredient fact; unknown contents mean no ingredient props. A pack colour, vitamin C, 'natural' or a source flower does not establish fruit, honey or botanicals. A scent note may be suggested as an aroma cue, never as food or an efficacy claim. VISIBILITY PLAN: a new pose may reveal only evidenced product surfaces. Keep unknown rear faces, closures, inside edges and attachments physically concealed by support, self-occlusion or the camera view; never invent them to complete a convenient arrangement.";
}
export function parseArtDirection(raw:unknown,a?:ProductAnalysis|null):ArtDirection|null{
 if(!raw||typeof raw!=="object")return null;const r=raw as Record<string,unknown>;
 const fields=["idea","mechanism","product_role","light_design","camera_design","styling","gesture","finish"] as const;
 if(fields.filter(k=>k!=="gesture"&&k!=="styling").some(k=>!text(r[k])))return null;
 if(!PHOTOGRAPHIC_APPROACHES.some(p=>p.id===r.mechanism))return null;
 const facts=groundedFacts(a),ids=Array.isArray(r.fact_ids)?r.fact_ids.filter((v):v is string=>typeof v==="string").slice(0,3):[];
 if(ids.some(id=>!facts.some(f=>f.id===id))||(facts.length>0&&ids.length===0))return null;
 const props:ArtDirection["ingredient_props"]=[];
 for(const value of Array.isArray(r.ingredient_props)?r.ingredient_props:[]){if(!value||typeof value!=="object")return null;const p=value as Record<string,unknown>,f=facts.find(f=>f.id===p.fact_id),name=text(p.name,100);if(!f||f.source!=="label"||!["ingredient","flavour"].includes(f.kind)||!name)return null;
  // Labels support only the named substance, not arbitrary props linked to an unrelated vitamin or colour.
  const meaningful=norm(f.value).split(" ").filter(w=>w.length>2&&!['flavour','flavor','extract','scent','with','and','water'].includes(w));
  if(!meaningful.length||!meaningful.some(w=>norm(name).includes(w)))return null;props.push({name,fact_id:f.id});
 }
 return {...Object.fromEntries(fields.map(k=>[k,text(r[k],k==="light_design"?320:240)||"none"])) as unknown as Pick<ArtDirection,typeof fields[number]>,fact_ids:ids,ingredient_props:props.slice(0,3)};
}
export function photographicFinish(category:CategoryId,human:string){return ["PHOTOGRAPHIC FINISH: controlled highlights with retained texture, motivated shadows and consistent colour temperature. A crisp focal subject with natural optical fall-off; no global over-sharpening, uniform blur, bloom or toy-like CGI sheen.",human!=="none"?"HUMAN FINISH: natural adult skin with subtle pores, fine hair and uneven micro-colour; no waxy smoothing or exaggerated pore texture. Believable knuckles, tendons, nail beds, grip pressure, garment contact and expression. Light the product and person as one scene.":"",category==="jewellery"?"JEWELLERY LIGHT: broad graduated metal reflections, restrained sparkle only where facets catch the key. No painted gold, glowing stone edges, fused settings or added ornament.":category==="fashion"?"TEXTILE LIGHT: retain actual weave, seam tension, motif scale, embroidery relief and restrained fabric sheen. Natural gravity, folds and contact; avoid airbrushed or repainted patterns.":category==="beauty"?"PACKAGING LIGHT: shape cylindrical glass and closures with controlled reflection bands; readable label, credible liquid refraction and true package finish. Do not infer formula texture from packaging colour.":category==="food"?"FOOD LIGHT: directional texture and believable moisture; no plastic glaze, fabricated steam, fillings or flavour ingredients. Preserve the actual serving and package.":"MATERIAL LIGHT: distinguish matte, gloss, metal, glass and rubber with material-specific highlights and grounded scale."].filter(Boolean).join("\n");}
