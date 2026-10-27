import { describe, expect, it } from "vitest";
import { SHOOT_STYLE_IDS, SHOOT_STYLES, shootRecipe } from "./shoots";
import { buildPrompt } from "./prompts";
import { directionPrompt, fallbackDirections } from "./director";
import { OUTPUTS, STYLES } from "./presets";
describe("photographic style contract", () => {
  it.each(SHOOT_STYLE_IDS)("%s has a visual and a distinct server recipe", id => {
    const recipe=shootRecipe(id,"beauty");
    expect(recipe.image).toMatch(/^\/catalog\/.+\.webp$/);
    expect(STYLES[recipe.scene]).toBeDefined();
    expect(recipe.brief.length).toBeGreaterThan(100);
  });
  it("keeps adult model direction and avoids unconfirmed application", () => {
    const recipe=shootRecipe("model","beauty");
    expect(recipe.human).toBe("model");
    expect(recipe.brief).toContain("no unconfirmed application");
  });
  it.each(["closeup","macro"] as const)("allows intentional cropping for %s without a whole-product contradiction", id => {
    const recipe=SHOOT_STYLES[id];
    const shot=fallbackDirections({ style:STYLES[recipe.scene], output:OUTPUTS.square, count:1, analysis:null, productName:"Leather bag", brief:recipe.brief, framing:recipe.framing, humanPresence:recipe.human })[0];
    const prompt=buildPrompt({mode:"preserve",category:"fashion",productName:"Leather bag",locks:[],style:recipe.scene,output:"square",direction:shot});
    expect(shot.framing).toBe(recipe.framing);
    if (id === "macro") expect(shot.camera).toContain("100mm macro");
    expect(prompt.text).toContain("intentional");
    expect(prompt.text).not.toContain("The whole product is visible");
  });
  it("requests concrete optical and human detail rather than generic realism", () => {
    const prompt=directionPrompt({style:STYLES.natural_sunlight, output:OUTPUTS.square,count:1,analysis:null,productName:"Bottle",framing:"macro",humanPresence:"model"});
    expect(prompt).toContain("FRAMING: macro");
    expect(prompt).toContain("separate fingers");
    expect(prompt).toContain("untrusted");
  });
});
