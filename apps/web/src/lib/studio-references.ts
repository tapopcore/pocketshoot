import "server-only";
import sharp from "sharp";
import type {StudioGeometry} from "@packshot/core";
/** A true source crop guides the requested optical detail; never pasted into the output. */
export async function studioReferences(images:Buffer[],geometry:StudioGeometry):Promise<Buffer[]>{
 const region=geometry.region;
 if(!region)return images;
 const original=images[geometry.references.indexOf(region.reference)];
 const source=original?await sharp(original).rotate().png().toBuffer():null;
 if(!source)throw new Error("The planned detail reference is missing");
 const meta=await sharp(source).metadata();
 if(!meta.width||!meta.height)throw new Error("The planned original has no dimensions");
 const left=Math.max(0,Math.floor(region.x*meta.width)),top=Math.max(0,Math.floor(region.y*meta.height));
 const width=Math.min(meta.width-left,Math.round(region.width*meta.width)),height=Math.min(meta.height-top,Math.round(region.height*meta.height));
 if(width<1||height<1)throw new Error("The planned feature is outside its original");
 const crop=await sharp(source).extract({left,top,width,height}).png().toBuffer();
 // Keep the complete photo that actually proves the requested component, even when the crop is inaccurate.
 return [source,crop];
}
