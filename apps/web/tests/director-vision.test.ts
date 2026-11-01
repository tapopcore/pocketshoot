import {beforeEach,it,expect,vi} from "vitest";
vi.mock("@/lib/env",()=>({integrations:{openai:true},env:{}}));
vi.mock("@/lib/llm",()=>({jsonCall:vi.fn()}));
vi.mock("@/lib/providers",()=>({getProvider:vi.fn()}));
vi.mock("@/lib/settings",()=>({getSettings:vi.fn(async()=>({providers:{llm:{models:["gpt-5-mini"]}}}))}));
vi.mock("@/lib/observe",()=>({logError:vi.fn()}));
import {jsonCall} from "@/lib/llm";
import {directShots} from "@/lib/prep";
import {commissionFor,OUTPUTS,STYLES,parseAnalysis} from "@packshot/core";
beforeEach(()=>vi.clearAllMocks());
it("lets the art director inspect the actual product once and preserves the commissioned role",async()=>{
 const a=parseAnalysis({name:"Gold choker",category:"jewellery",description:"Floral choker",materials:["gold-coloured metal"],visible_text:[]},[])!;
 const commission=commissionFor({analysis:a,look:{human:"model",environment:"indoor",framing:"full",directionRole:"human-detail"},edition:1,slot:0});
 vi.mocked(jsonCall).mockResolvedValueOnce({data:{shots:[{scene:"A selective product-on-body study with a "+commission.paletteName+" background",lighting:"A shaped side key",camera:"A tight product/body composition",product_scale:.6,offset_x:0,baseline:.8,artDirection:{idea:"Metal relief against actual skin",fact_ids:["material0"],mechanism:"intimate-human-detail",product_role:"Worn choker",light_design:"Shaped side key with negative fill",camera_design:"Tight body study",styling:"A quiet tonal field",gesture:"A natural collarbone gesture",finish:"Retained metal and skin texture",ingredient_props:[]}}]},model:"gpt-5-mini",inputTokens:100,outputTokens:100});
 const original=Buffer.from("test-original-product-bytes");
 const result=await directShots({style:STYLES.natural_sunlight,output:OUTPUTS.square,count:1,analysis:a,productName:a.name,assignments:[{title:"Wearable detail",brief:"The real set worn naturally",humanPresence:"model",framing:"full",environment:"indoor",commission}]},[original]);
 expect(jsonCall).toHaveBeenCalledOnce();expect(vi.mocked(jsonCall).mock.calls[0][0].images).toEqual([original]);expect(vi.mocked(jsonCall).mock.calls[0][0].imageLabels?.[0]).toContain("ORIGINAL PRODUCT");
 expect(result.source).toBe("ai");expect(result.shots[0].artDirection?.commission?.role).toBe("human-detail");
});

it("repairs a forbidden visible retail display before returning a renderable plan",async()=>{
 const a=parseAnalysis({name:"Gold choker",category:"jewellery",description:"Floral choker",materials:["gold-coloured metal"],visible_text:[]},[])!;
 const commission=commissionFor({analysis:a,look:{human:"none",environment:"indoor",framing:"full",directionRole:"graphic"},edition:2,slot:0});
 const raw={scene:commission.paletteName+" backdrop with a visible retail bust",lighting:"A shaped side key",camera:"Sculptural diagonal",product_scale:.6,offset_x:0,baseline:.8,artDirection:{idea:"Metal relief and negative space",fact_ids:["material0"],mechanism:"authored-still-life",product_role:"Sculptural actual set",light_design:"Shaped side key",camera_design:"Diagonal composition",styling:commission.paletteName+" field",gesture:"none",finish:"Retained metal texture",ingredient_props:[]}};
 const meta={model:"gpt-5-mini",inputTokens:100,outputTokens:100};
 vi.mocked(jsonCall).mockResolvedValueOnce({...meta,data:{shots:[raw]}}).mockResolvedValueOnce({...meta,data:{shots:[{...raw,scene:commission.paletteName+" field with concealed support and a deliberately diagonal actual set"}]}});
 const result=await directShots({style:STYLES.natural_sunlight,output:OUTPUTS.square,count:1,analysis:a,productName:a.name,assignments:[{title:"Graphic",brief:"Actual set as a sculptural composition",humanPresence:"none",framing:"full",environment:"indoor",commission}]},[Buffer.from("original")]);
 expect(jsonCall).toHaveBeenCalledTimes(2);expect(vi.mocked(jsonCall).mock.calls[1][0].prompt).toContain("no visible retail bust");expect(result.source).toBe("ai");expect(result.shots[0].scene).not.toContain("retail bust");
});
