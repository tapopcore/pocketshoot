import {describe,it,expect} from "vitest";
import {creativeWorld,shotHistory} from "./creative-world";
import {directionPrompt} from "./director";
import {STYLES,OUTPUTS} from "./presets";
describe("fresh creative territory",()=>{
 it("stays stable for restarts but varies across repeat shoots",()=>{expect(creativeWorld("a","necklace")).toBe(creativeWorld("a","necklace"));expect(new Set(Array.from({length:100},(_,i)=>creativeWorld(String(i),"necklace"))).size).toBeGreaterThan(80);});
 it("tracks optical and lighting history, not props alone",()=>{expect(shotHistory({scene:"courtyard",camera:"85mm low",lighting:"hard sun"})).toContain("85mm low");});
 it("lets product-specific territory supersede fixed recipe scenery",()=>{const p=directionPrompt({style:Object.values(STYLES)[0],output:OUTPUTS.square,count:1,analysis:null,productName:"shoe",creativeTerritory:"graphic shadows",avoid:["a prior set"]});expect(p).toContain("graphic shadows");expect(p).toContain("Change at least three");expect(p).not.toContain("SCENE RECIPE");});
});
