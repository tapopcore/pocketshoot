import type {ShotDirection} from "@packshot/core";
/** Reject a planning contradiction before purchasing pixels. This is not an anatomy judgement. */
export function humanActionProblem(shot:ShotDirection,expected:"none"|"hands"|"model"){
 if(expected==="none")return null;
 const scene=[shot.scene,shot.artDirection?.styling,shot.artDirection?.gesture].filter(Boolean).join(" ").replace(/\b(?:no|without)\s+(?:visible\s+)?(?:hands?|people|person|model)\b/gi,"");
 const action=expected==="hands"?/\bhand|finger|palm|wrist|grip|held|holding\b/i:/\badult|person|woman|man|wear|body|skin|model|face|torso|shoulder|collarbone\b/i;
 return action.test(scene)?null:"The scene must describe the required "+expected+" contact, rather than a product-only still life.";
}
