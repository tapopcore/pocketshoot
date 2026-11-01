/** Persisted, comparable creative decisions. Identity and selected view are never randomised. */
export const CREATIVE_EDITION_VERSION="2026-11-01.editions-1";
export interface CreativeSpec {version:string;edition:number;contract:string;environment:"indoor"|"outdoor"|"studio";layout:number;light:number;display:number;scale:number;world:number}
export const layouts=[
 "Place the complete merchandise group on the LEFT third; large clean negative space to the right.",
 "Place the complete merchandise group on the RIGHT third; large clean negative space to the left.",
 "Use a low, wide visual arrangement across the LOWER third; generous clear space above.",
 "Use a tall, centred visual arrangement with close, balanced margins and strong vertical rhythm.",
 "Place the merchandise in the upper-middle of the frame, leaving an unusually generous clean foreground below.",
 "Use an asymmetric arrangement with strong near/far spacing between existing pieces; never invent or duplicate a piece.",
];
export const lights=[
 "Large soft key from camera-left, soft right fill; long delicate shadow to the right.",
 "Large soft key from camera-right, restrained left fill; delicate shadow to the left.",
 "Broad overhead diffusion, short grounded contact shadow and gentle tonal roll-off.",
 "Narrow controlled side key from the left with crisp but physically plausible shape-defining shadows.",
 "Restrained back-right rim and broad neutral front fill; distinct edge separation without changing material colour.",
 "Restrained back-left rim and broad neutral front fill; distinct edge separation without changing material colour.",
 "Low grazing right key reveals genuine surface relief; controlled soft bounce keeps markings readable.",
 "A large bounced frontal key and higher side fill give an airy, nearly shadowless but grounded photographic rendering.",
];
const displays=[
 "Present merchandise in its natural stable resting position directly on a clean surface. Any flexible piece may use a discreet neutral cradle; do not automatically reuse the source bust or peg.",
 "Use a minimal custom neutral cradle or unobtrusive suspension ONLY when the product actually needs support. Preserve the supplied front-facing design and assembly; do not invent hidden faces.",
 "Build a restrained spatial arrangement from the actual product silhouette; for a multi-piece set change the relative placement of existing pieces while showing all of them. No additional units or invented parts.",
 "Integrate physically necessary support into the set's edge or contour, with real weight and contact. Replace the old source display arrangement; rigid products stay rigid and flexible merchandise keeps its visible design.",
 "Use a simple shallow plane with deliberate negative space and no decorative podium. If the product needs support, use a neutral low-profile support rather than recreating the old bust-plus-peg display.",
 "Use a front-facing presentation with a discreet support hidden behind the product where physically possible. Keep merchandise fully readable and do not copy the source's visible display furniture.",
];
const gestures=["A relaxed frontal stance with one purposeful, natural interaction.","A slight weight shift and a fresh hand position with all product design visible.","A seated, upright moment only if full merchandise remains readable; otherwise a relaxed standing pause.","A moment just before practical use, with natural asymmetry and correct contact.","A deliberate presentation gesture different from the source photograph.","A gentle candid movement captured at rest; no occlusion of key product details."];
const worlds=["contemporary architecture and spatial depth","an authentic buyer's daily ritual","a tactile craft or making context","quiet leisure and a real pause","contemporary gifting without stock festive clutter","a bold graphic relationship between product colour and space","a practical working context","an open natural landscape with product-appropriate protection","a materially specific editorial set","a restrained retail or gallery context","a contemporary Indian domestic or cultural context","a new product-led spatial concept invented for this campaign"];
function hash(v:string){let n=2166136261;for(const c of v)n=Math.imul(n^c.charCodeAt(0),16777619);n^=n>>>16;n=Math.imul(n,0x85ebca6b);return(n^(n>>>13))>>>0;}
export function creativeDistance(a:CreativeSpec,b:CreativeSpec){return (["layout","light","display","scale","world"] as const).filter(k=>a[k]!==b[k]).length;}
export function chooseCreativeSpec(input:{family:string;edition:number;slot:number;contract:string;environment:CreativeSpec["environment"];previous?:CreativeSpec[];siblings?:CreativeSpec[]}):CreativeSpec{
 const previous=(input.previous??[]).filter(p=>p.contract===input.contract&&p.environment===input.environment).slice(0,24);
 let best:CreativeSpec|null=null;
 for(let c=0;c<4096;c++){
  const seed=input.family+":"+input.edition+":"+input.slot+":"+c;
  const pick=(axis:string,n:number)=>hash(seed+":"+axis)%n;
  const candidate:CreativeSpec={version:CREATIVE_EDITION_VERSION,edition:input.edition,contract:input.contract,environment:input.environment,layout:(input.edition+input.slot+hash(input.family+":layout")+c%6)%layouts.length,light:(input.edition*3+input.slot+hash(input.family+":light")+Math.floor(c/6)%8)%lights.length,display:pick("display",displays.length),scale:(input.edition+input.slot+hash(input.family+":scale")+Math.floor(c/48)%3)%3,world:input.environment==="studio"?0:(input.edition+input.slot+hash(input.family+":world"))%worlds.length};
  if(input.siblings?.some(p=>p.layout===candidate.layout&&p.light===candidate.light))continue;
  const latest=previous[0];
  if(latest&&(candidate.layout===latest.layout||candidate.light===latest.light||candidate.scale===latest.scale))continue;
  const distances=previous.map(p=>creativeDistance(candidate,p));
  if(distances.some(d=>d===0)||distances.slice(0,3).some(d=>d<3))continue;
  best=candidate;break;
 }
 if(!best)throw new Error("Could not allocate a distinct compatible shoot direction before image spending");
 return best;
}
export function creativeSpecPrompt(spec:CreativeSpec,human="none",crop=false):string{
 const display=human==="none"?displays[spec.display]:gestures[spec.display];
 return ["NEW SHOOT EDITION "+spec.edition+" — visual changes are mandatory, not optional styling.",crop?layouts[spec.layout].replace(/complete merchandise group|merchandise/g,"selected visible detail"):layouts[spec.layout],
 crop?"Intentional crop of a different clearly resolved visible feature. Never fabricate unseen microdetail.":"Subject group occupies approximately "+[52,66,80][spec.scale]+" percent of the frame's short side; maintain safe margins and complete inventory.",
 "LIGHT GEOMETRY: "+lights[spec.light],"PRESENTATION: "+display,
 spec.environment==="studio"?"The background remains seamless pure white, with no decorative props. Distinction must come from composition, optical scale, support/arrangement and motivated lighting; never invent an unseen angle.":"Invent a specific NEW compatible place and set within this conceptual world: "+worlds[spec.world]+". Keep the selected indoor/outdoor environment and theme. Choose actual setting, materials and action from the product's use and observed construction, not a stock backdrop recipe.",
 "Preserve product geometry, exact visible design, supplied assembly, count and source-supported view. Do not mirror logos, rotate a flat source to pretend it is a new view, add merchandise, or recolour the product. A support is not merchandise."
 ].join("\n");
}
