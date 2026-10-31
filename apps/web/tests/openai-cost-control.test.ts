import { beforeEach, describe, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({edit:vi.fn(),response:vi.fn()}));
vi.mock("@/lib/env",()=>({env:{openaiKey:"test-only"}}));
vi.mock("@/lib/llm",()=>({openai:()=>({images:{edit:f.edit}})}));
import {openaiProvider} from "@/lib/providers/openai";
const provider=openaiProvider({models:["gpt-image-2.5-sunburst"],quality:"medium",legacyQuality:"medium",prices:{default:{input:1,output:2}}});
const request={prompt:"Photograph the original product",images:[Buffer.from("test-product")],width:1024,height:1024,timeoutMs:30000};
beforeEach(()=>{vi.clearAllMocks();f.edit.mockReturnValue({withResponse:f.response});});
describe("image request cost and traceability",()=>{
 it("requests one output with the configured quality, no SDK retries, and retains the provider request ID",async()=>{
  f.response.mockResolvedValue({data:{data:[{b64_json:Buffer.from("image").toString("base64")}],usage:{input_tokens:10,output_tokens:20}},request_id:"req_test"});
  const result=await provider.edit(request,"gpt-image-2.5-sunburst");
  expect(f.edit).toHaveBeenCalledTimes(1);
  expect(f.edit.mock.calls[0][0]).toMatchObject({n:1,quality:"medium"});
  expect(f.edit.mock.calls[0][1]).toMatchObject({maxRetries:0});
  expect(result.requestId).toBe("req_test");
 });
 it("keeps a timeout request ID instead of hiding a potentially charged call in SDK retries",async()=>{
  f.response.mockRejectedValue({status:408,message:"Request timed out",request_id:"req_timeout"});
  await expect(provider.edit(request,"gpt-image-2.5-sunburst")).rejects.toMatchObject({code:"timeout",requestId:"req_timeout"});
  expect(f.edit).toHaveBeenCalledTimes(1);
 });
});
