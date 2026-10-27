import { z } from "zod";
import { handler, ApiError, body } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { categoryLook, collectionById, lookEligibility, RECIPE_VERSION, type ShootProfile } from "@packshot/core";
const schema=z.object({productId:z.string().uuid(),recipeId:z.string(),count:z.number().int().min(1).max(20)});
export const POST=handler(async(req,ctx)=>{
 const input=await body(req,schema);
 const {data:p}=await admin().from("products").select("category,attributes").eq("id",input.productId).eq("organization_id",ctx.orgId).is("archived_at",null).maybeSingle();
 if(!p)throw new ApiError(404,"Product not found");
 const profile=(p.attributes as {shootProfile?:ShootProfile}|null)?.shootProfile;
 const look=categoryLook(input.recipeId);
 if(!profile||!look||collectionById(profile.type)?.category!==p.category)throw new ApiError(400,"Confirm this product and choose a compatible look.");
 const {data:refs}=await admin().from("product_assets").select("view_type").eq("product_id",input.productId);
 const issue=lookEligibility(look,profile,refs??[]);if(issue)throw new ApiError(400,issue,"reference_required");
 const policy=(await getSettings()).credit_policy;
 if(input.count>policy.maxImagesPerJob)throw new ApiError(400,"Reduce the number of images.");
 return {credits:input.count*policy.creditsPerImage,recipeVersion:RECIPE_VERSION};
});
