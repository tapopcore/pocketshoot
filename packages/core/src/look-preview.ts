/** Static illustrations only; never generates a paid per-upload preview. */
export function lookPreviewId(id:string){return ({"studio-depth":"studio-three-quarter","studio-pose":"studio-diagonal","studio-arrangement":"studio-low"} as Record<string,string>)[id]??id;}
