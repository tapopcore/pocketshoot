/** Forecasts are admission controls, never provider invoice guarantees. */
export const COST_POLICY = "2026-10-31.five-rupee-1";
export const IMAGE_COST_LIMIT_INR = 5;
export const ECONOMY_EDGE = 1024;
export const ECONOMY_QUALITY = "medium" as const;
export function imageUsageCost(model:string, usage:{input_tokens?:number;output_tokens?:number;input_tokens_details?:{text_tokens?:number;image_tokens?:number}}, prices:Record<string,{input:number;output:number}>) {
 const p=prices[model]??prices.default;
 if(!p || usage.output_tokens===undefined || usage.input_tokens===undefined)return undefined;
 const text=usage.input_tokens_details?.text_tokens;
 const image=usage.input_tokens_details?.image_tokens;
 // 2.5 text input is $5/M and image input $8/M. Older rows without a split stay conservative.
 const input=/gpt-image-2\.5/.test(model)&&text!==undefined&&image!==undefined ? text*5+image*8 : usage.input_tokens*p.input;
 return (input+usage.output_tokens*p.output)/1e6;
}
export function forecastImageInr(prompt:string, references:number, fx:number) {
 // Safety allowance from observed production usage, NOT an official 2.5 tokenizer formula.
 return (Math.ceil(Buffer.byteLength(prompt,"utf8")/3)*5+references*1200*8+700*30)/1e6*fx;
}
export function textUsageCost(model:string,input:number,output:number,cached=0) {
 const p=/^gpt-5-mini(?:-|$)/.test(model)?[.25,2,.025]:/^gpt-4\.1-mini(?:-|$)/.test(model)?[.4,1.6,.1]:null;
 if(!p)return undefined;
 return ((input-cached)*p[0]+cached*p[2]+output*p[1])/1e6;
}
export function selectReferences<T extends {view_type:string}>(refs:T[],lookId?:string):T[] {
 const front=refs.find(r=>r.view_type==="front")??refs[0]; if(!front)return [];
 const target=lookId==="studio-back"?"back":lookId==="studio-side"?"side":/detail|texture/.test(lookId??"")?"detail":"angle";
 const support=refs.find(r=>r!==front&&r.view_type===target)??refs.find(r=>r!==front&&r.view_type==="detail")??refs.find(r=>r!==front);
 return support?[front,support]:[front];
}
