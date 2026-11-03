import {it,expect} from "vitest";
import {humanActionProblem} from "@/lib/direction-validation";
const s=(scene:string,gesture="none")=>({scene,lighting:"key",camera:"85mm",product_scale:.6,offset_x:0,baseline:.8,artDirection:{gesture}} as never);
it("rejects the botanical still-life contradiction before image generation",()=>expect(humanActionProblem(s("A can and Centella sprig on a white tile"),"hands")).not.toBeNull());
it("accepts a concrete grip",()=>expect(humanActionProblem(s("An adult holds the bottle in her palm","Fingers naturally curl around the can"),"hands")).toBeNull());
it("does not count no hands as a requested hand action",()=>expect(humanActionProblem(s("Can with no hands on a white surface"),"hands")).not.toBeNull());
it("keeps product-only shots available",()=>expect(humanActionProblem(s("Can on a white surface"),"none")).toBeNull());
