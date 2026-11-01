import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {localOriginalityCheck} from "@/lib/visual-originality";
async function sample(x=160,colour="#d9932c",background="#ffffff"){return sharp(Buffer.from('<svg width="512" height="512"><rect width="512" height="512" fill="'+background+'"/><rect x="'+x+'" y="110" width="120" height="250" rx="18" fill="'+colour+'"/><rect x="'+(x+30)+'" y="170" width="60" height="70" fill="#222"/></svg>')).png().toBuffer();}
describe("local visual repetition check",()=>{
 it("rejects a re-encoded duplicate without using an external AI call",async()=>{const a=await sample(),b=await sharp(a).jpeg({quality:91}).toBuffer();const check=await localOriginalityCheck(b,[{id:"prior",image:a}]);expect(check.decision).toBe("fail");expect(check.details).toMatchObject({matchedAssetId:"prior",compared:1});});
 it("accepts a meaningful composition and setting change while the product remains the same",async()=>{const check=await localOriginalityCheck(await sample(330,"#d9932c","#9ebdb3"),[{id:"prior",image:await sample(50)}]);expect(check.decision).toBe("pass");});
 it("does not turn absent history into a claim of verified uniqueness",async()=>{const check=await localOriginalityCheck(await sample(),[]);expect(check.details).toMatchObject({compared:0});});
});
