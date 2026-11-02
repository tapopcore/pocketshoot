import {it,expect} from "vitest";
import {generationFailure} from "@/lib/generation-failure";
it("offers budget recovery without falsely exhausting attempts",()=>{const r=generationFailure("cost_budget: no additional paid request");expect(r.action).toBe("retry");expect(r.message).toContain("remaining");expect(r.message).not.toContain("all its tries");});
it("never displays gateway HTML to a customer",()=>{expect(generationFailure("direction_unavailable: <html>502 Bad Gateway</html>").message).not.toContain("html");});
it("offers source recovery for unsupported views",()=>{expect(generationFailure("studio_reference_needed: source not visible").action).toBe("references");});
