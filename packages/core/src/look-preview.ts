/** Reuse existing studio demo photos for honest composition examples, never per-upload image calls. */
export function lookPreviewId(id:string){return id==="studio-offset"?"studio-front":id==="studio-texture"?"studio-detail":id;}
