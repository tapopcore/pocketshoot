/** Creative axes, not pre-written background templates. One territory per shoot. */
const axes = {
 composition: ["sculptural negative space", "intimate observational moment", "bold colour-field geometry", "layered foreground depth", "graphic light and shadow", "tactile material contrast", "quiet asymmetry", "unexpected scale relationship", "architectural framing", "documentary closeness", "rhythmic arrangement", "restrained tonal study"],
 light: ["raking early daylight", "broad overcast daylight", "late afternoon side light", "crisp motivated directional light", "large soft bounced light", "restrained edge separation", "warm reflected evening light", "cool skylight and warm reflected fill"],
 display: ["free resting merchandise", "a restrained custom support", "graphic asymmetry with substantial negative space", "a near/far spatial relationship", "a support integrated into the actual location", "a physically natural arrangement different from the source display"],
 story: ["the maker's craft", "a pause in a daily routine", "material and touch", "form and function", "a personal ritual", "movement becoming stillness", "contemporary Indian design", "a gift being chosen", "colour in the buyer's life", "precision and care", "lasting everyday value", "a moment before an occasion"],
};
function hash(value: string) { let n = 2166136261; for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619); n ^= n >>> 16; n=Math.imul(n,0x85ebca6b); n ^= n >>> 13; n=Math.imul(n,0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; }
const locations={
 outdoor:["an open coastal landscape", "a contemporary urban terrace", "a tree-lined garden path", "an open foothill landscape", "a cultivated field edge", "a contemporary architectural forecourt", "a lakeside promenade", "a dry stone landscape", "an urban public park", "a quiet open courtyard", "a shaded tropical garden", "an exterior workshop threshold"],
 indoor:["a contemporary Indian home", "an artist's working studio", "a restrained urban cafe", "a modern gallery interior", "a textile or craft workspace", "a residential architectural niche", "a thoughtfully edited retail interior", "a real buyer's preparation ritual", "a graphic material-led set", "a practical contemporary workspace", "a personal dressing space", "a quiet hospitality interior"],
 studio:["seamless pure-white studio; vary lighting, optical scale, spacing and supported display, never the background colour or decorative props"]
};
export function creativeWorld(shootId:string,product:string,slot=0,environment:"indoor"|"outdoor"|"studio"="indoor"):string{
 const seed=shootId+":"+product+":"+slot;
 const place=locations[environment][hash(seed+":location")%locations[environment].length];
 return "location family: "+place+"; "+Object.entries(axes).map(([axis,choices])=>axis+": "+choices[hash(seed+":"+axis)%choices.length]).join("; ");
}
/** Do not feed complete old briefs back into a model: it copies their staging and phrasing. */
export function shotHistory(shot:{scene?:string;camera?:string;lighting?:string}|undefined):string{
 if(!shot)return "";
 const scene=(shot.scene??"").toLowerCase(),light=(shot.lighting??"").toLowerCase();
 const tags=(text:string,words:string[])=>words.filter(w=>text.includes(w));
 return JSON.stringify({
  setting:tags(scene,["courtyard","coast","beach","garden","terrace","sky","gallery","home","cafe","workshop","kitchen","window","sweep","wall","field","lake"]),
  support:tags(scene,["bust","peg","podium","plinth","stand","hand","table","plank","slab","tray","hanger"]),
  material:tags(scene,["wood","stone","brass","linen","paper","velvet","terracotta","glass"]),
  light:tags(light,["soft","hard","crisp","warm","cool","rim","side","left","right","morning","afternoon","window","shade"]),
  camera:(shot.camera??"").match(/\d+[–-]?\d*\s?mm|f\/\d+(?:\.\d+)?|overhead|straight.on|low|high|close|wide|eye.level/gi)??[]
 });
}

/** Known outdoor scenes remain outdoors; a festive theme can support different locations. */
export function shootEnvironment(scene:string,selected:string|undefined,lookEnvironment:"indoor"|"outdoor"|"studio"|undefined,shootId:string,slot:number):"indoor"|"outdoor"|"studio"{
 if(lookEnvironment)return lookEnvironment;
 if(scene==="pure_white")return "studio";
 if(selected==="outdoor"||["outdoor_location","beach_sand","forest_moss","monsoon","summer"].includes(scene))return "outdoor";
 if(selected==="indoor")return "indoor";
 if(["festive","gifting","holi_colours","christmas","wedding"].includes(scene))return hash(shootId+":"+slot+":setting")%2?"outdoor":"indoor";
 return "indoor";
}
