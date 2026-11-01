import {describe,it,expect} from "vitest";
import {creativeWorld,shotHistory,shootEnvironment} from "./creative-world";
import {directionPrompt} from "./director";
import {STYLES,OUTPUTS} from "./presets";
describe("fresh creative territory",()=>{
 it("stays stable for restarts but varies across repeat shoots",()=>{expect(creativeWorld("a","necklace")).toBe(creativeWorld("a","necklace"));expect(new Set(Array.from({length:100},(_,i)=>creativeWorld(String(i),"necklace"))).size).toBeGreaterThan(80);});
 it("tracks optical and lighting history, not props alone",()=>{expect(shotHistory({scene:"courtyard",camera:"85mm low",lighting:"hard sun"})).toContain("85mm");});
 it("lets product-specific territory supersede fixed recipe scenery",()=>{const p=directionPrompt({style:Object.values(STYLES)[0],output:OUTPUTS.square,count:1,analysis:null,productName:"shoe",creativeTerritory:"graphic shadows",avoid:["a prior set"]});expect(p).toContain("graphic shadows");expect(p).toContain("Change at least three");expect(p).not.toContain("SCENE RECIPE");});
});

it("uses distinct compatible location families while keeping white studio fixed",()=>{expect(creativeWorld("new","jewel",0,"outdoor")).toContain("location family:");expect(creativeWorld("new","jewel",0,"studio")).toContain("seamless pure-white");expect(new Set(Array.from({length:40},(_,i)=>creativeWorld(String(i),"jewel",0,"outdoor").split(";")[0])).size).toBeGreaterThan(8);});
it("does not copy historical staging sentences or distinctive prop phrases",()=>{const h=shotHistory({scene:"The choker sits on a display bust beside a carved sandalwood bead and a matte gold peg in a courtyard",lighting:"warm side light",camera:"85mm f/8 straight-on"});expect(h).toContain("bust");expect(h).not.toContain("carved sandalwood bead");expect(h).not.toContain("The choker");});

it("keeps selected and inherently outdoor scenes in the right environment",()=>{expect(shootEnvironment("beach_sand",undefined,undefined,"a",0)).toBe("outdoor");expect(shootEnvironment("festive",undefined,"studio","a",0)).toBe("studio");expect(new Set(Array.from({length:20},(_,i)=>shootEnvironment("festive",undefined,undefined,String(i),0))).size).toBe(2);});
