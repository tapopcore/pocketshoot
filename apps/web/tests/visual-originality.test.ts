import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {localOriginalityCheck} from "@/lib/visual-originality";
async function sample(x=160,colour="#d9932c",background="#ffffff"){return sharp(Buffer.from('<svg width="512" height="512"><rect width="512" height="512" fill="'+background+'"/><rect x="'+x+'" y="110" width="120" height="250" rx="18" fill="'+colour+'"/><rect x="'+(x+30)+'" y="170" width="60" height="70" fill="#222"/></svg>')).png().toBuffer();}
describe("local visual repetition check",()=>{
 it("rejects a re-encoded duplicate without using an external AI call",async()=>{const a=await sample(),b=await sharp(a).jpeg({quality:91}).toBuffer();const check=await localOriginalityCheck(b,[{id:"prior",image:a}]);expect(check.decision).toBe("fail");expect(check.details).toMatchObject({matchedAssetId:"prior",compared:1});});
 it("accepts a meaningful composition and setting change while the product remains the same",async()=>{const check=await localOriginalityCheck(await sample(330,"#d9932c","#9ebdb3"),[{id:"prior",image:await sample(50)}]);expect(check.decision).toBe("pass");});
 it("does not turn absent history into a claim of verified uniqueness",async()=>{const check=await localOriginalityCheck(await sample(),[]);expect(check.details).toMatchObject({compared:0});});
});

import {studioOriginalityCheck} from "@/lib/visual-originality";
describe("studio foreground uniqueness",()=>{
 it("accepts different label faces on the same narrow cylindrical outline",async()=>{
  const bottle=async(back:boolean)=>sharp(Buffer.from(`<svg width="512" height="512"><rect width="512" height="512" fill="white"/><rect x="225" y="70" width="62" height="370" rx="8" fill="#222"/><rect x="231" y="180" width="50" height="180" fill="#eee"/>${back?Array.from({length:16},(_,i)=>`<rect x="235" y="${188+i*10}" width="42" height="3" fill="#333"/>`).join(""):`<rect x="238" y="200" width="35" height="60" fill="#333"/><circle cx="256" cy="310" r="16" fill="#b57d21"/>`}</svg>`)).png().toBuffer();
  expect((await studioOriginalityCheck(await bottle(true),[{id:"front",image:await bottle(false)}])).decision).toBe("pass");
 });
 it("rejects a zoomed and translated copy on white",async()=>{
  const a=await sample();
  const small=await sharp(a).resize(300,300).extend({left:140,right:72,top:60,bottom:152,background:"#fff"}).png().toBuffer();
  expect((await studioOriginalityCheck(small,[{id:"first",image:a}])).decision).toBe("fail");
 });
 it("rejects a two-dimensional diagonal rotation presented as a new angle",async()=>{
  const a=await sample();
  const rotated=await sharp(a).rotate(35,{background:"#fff"}).png().toBuffer();
  expect((await studioOriginalityCheck(rotated,[{id:"first",image:a}])).decision).toBe("fail");
 });
 it("accepts a visibly changed projection with different face relationships",async()=>{
  const b=await sharp(Buffer.from('<svg width="512" height="512"><path d="M120 160 L270 90 L390 180 L310 390 L140 350Z" fill="#d9932c"/><path d="M270 90L390 180L310 390L260 290Z" fill="#74401a"/></svg>')).flatten({background:"#fff"}).png().toBuffer();
  expect((await studioOriginalityCheck(b,[{id:"first",image:await sample()}])).decision).toBe("pass");
 });
});
