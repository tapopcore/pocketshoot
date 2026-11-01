import {it,expect,vi} from "vitest";
vi.mock("@/lib/env",()=>({integrations:{openai:true},env:{}}));
vi.mock("@/lib/llm",()=>({jsonCall:vi.fn()}));
vi.mock("@/lib/providers",()=>({getProvider:vi.fn()}));
vi.mock("@/lib/settings",()=>({getSettings:vi.fn(async()=>({providers:{llm:{models:["gpt-5-mini"]}}}))}));
vi.mock("@/lib/observe",()=>({logError:vi.fn()}));
import {jsonCall} from "@/lib/llm";
import {directShots} from "@/lib/prep";
import {commissionFor,OUTPUTS,STYLES,parseAnalysis} from "@packshot/core";
it("lets the art director inspect the actual product once and preserves the commissioned role",async()=>{
 const a=parseAnalysis({name:"Gold choker",category:"jewellery",description:"Floral choker",materials:["gold-coloured metal"],visible_text:[]},[])!;
 const commission=commissionFor({analysis:a,look:{human:"model",environment:"indoor",framing:"full",directionRole:"human-detail"},edition:1,slot:0});
 vi.mocked(jsonCall).mockResolvedValueOnce({data:{shots:[{scene:"A selective product-on-body study with a deep tonal background",lighting:"A shaped side key",camera:"A tight product/body composition",product_scale:.6,offset_x:0,baseline:.8,artDirection:{idea:"Metal relief against actual skin",fact_ids:["material0"],mechanism:"intimate-human-detail",product_role:"Worn choker",light_design:"Shaped side key with negative fill",camera_design:"Tight body study",styling:"A quiet tonal field",gesture:"A natural collarbone gesture",finish:"Retained metal and skin texture",ingredient_props:[]}}]},model:"gpt-5-mini",inputTokens:100,outputTokens:100});
 const original=Buffer.from("test-original-product-bytes");
 const result=await directShots({style:STYLES.natural_sunlight,output:OUTPUTS.square,count:1,analysis:a,productName:a.name,assignments:[{title:"Wearable detail",brief:"The real set worn naturally",humanPresence:"model",framing:"full",environment:"indoor",commission}]},[original]);
 expect(jsonCall).toHaveBeenCalledOnce();expect(vi.mocked(jsonCall).mock.calls[0][0].images).toEqual([original]);expect(vi.mocked(jsonCall).mock.calls[0][0].imageLabels?.[0]).toContain("ORIGINAL PRODUCT");
 expect(result.source).toBe("ai");expect(result.shots[0].artDirection?.commission?.role).toBe("human-detail");
});
