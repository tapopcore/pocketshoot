/** Creative axes, not pre-written background templates. One territory per shoot. */
const axes = {
 composition: ["sculptural negative space", "intimate observational moment", "bold colour-field geometry", "layered foreground depth", "graphic light and shadow", "tactile material contrast", "quiet asymmetry", "unexpected scale relationship", "architectural framing", "documentary closeness", "rhythmic arrangement", "restrained tonal study"],
 light: ["raking early daylight", "broad overcast daylight", "late afternoon side light", "crisp motivated directional light", "large soft bounced light", "restrained edge separation", "warm reflected evening light", "cool skylight and warm reflected fill"],
 story: ["the maker's craft", "a pause in a daily routine", "material and touch", "form and function", "a personal ritual", "movement becoming stillness", "contemporary Indian design", "a gift being chosen", "colour in the buyer's life", "precision and care", "lasting everyday value", "a moment before an occasion"],
};
function hash(value: string) { let n = 2166136261; for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619); n ^= n >>> 16; n=Math.imul(n,0x85ebca6b); n ^= n >>> 13; n=Math.imul(n,0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; }
export function creativeWorld(shootId: string, product: string, slot = 0): string {
 return Object.entries(axes).map(([axis, choices]) => axis + ": " + choices[hash(shootId + ":" + product + ":" + slot + ":" + axis) % choices.length]).join("; ");
}
export function shotHistory(shot: { scene?: string; camera?: string; lighting?: string } | undefined): string {
 return shot ? JSON.stringify({scene:shot.scene,camera:shot.camera,lighting:shot.lighting}) : "";
}
