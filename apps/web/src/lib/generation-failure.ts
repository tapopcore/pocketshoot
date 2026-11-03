/** Public recovery copy must describe the stage, never pretend attempts were exhausted. */
export function generationFailure(error:string|null){
 const code=(error??"").split(":",1)[0];
 if(code==="cost_budget")return {title:"Photo paused",message:"The request did not fit the remaining shared shoot budget. Your credit was released.",action:"retry" as const};
 if(code==="studio_reference_needed"||code==="missing_reference")return {title:"Another view is needed",message:"This shot needs a clearer product view. Your other supported photos can still finish.",action:"references" as const};
 if(code==="direction_unavailable")return {title:"Shoot preparation stopped",message:"We could not finish preparing this shot. Your credit was released.",action:"retry" as const};
 return {title:"This photo needs attention",message:(error??"The photo could not be completed. Your credit was released.").replace(/^[a-z_]+:\s*/,"").split(/(?<=\.)\s/)[0],action:"retry" as const};
}
