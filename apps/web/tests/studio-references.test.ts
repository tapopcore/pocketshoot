import {it,expect} from "vitest";
import sharp from "sharp";
import {studioReferences} from "@/lib/studio-references";
import type {StudioGeometry} from "@packshot/core";
it("uses original inventory plus the actual requested source feature, without buying a preview",async()=>{
 const source=await sharp(Buffer.from('<svg width="400" height="200"><rect width="200" height="200" fill="red"/><rect x="200" width="200" height="200" fill="blue"/></svg>')).png().toBuffer();
 const geometry={references:[1],region:{reference:1,x:.5,y:0,width:.5,height:1}} as StudioGeometry;
 const prepared=await studioReferences([source],geometry);
 expect(prepared).toHaveLength(2);expect(prepared[0]).toBe(source);
 const {data,info}=await sharp(prepared[1]).removeAlpha().raw().toBuffer({resolveWithObject:true});
 expect(info.width).toBe(200);expect(info.height).toBe(200);
 expect([...data.subarray(0,3)]).toEqual([0,0,255]);
});
