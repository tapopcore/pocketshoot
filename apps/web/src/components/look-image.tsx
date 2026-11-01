/* eslint-disable @next/next/no-img-element -- locally sized, original demo photographs. */
import {lookPreviewId,type CategoryLook} from "@packshot/core";

/** Static examples, shared by every visitor. Never a paid preview of an upload. */
export function LookImage({ look, className = "", eager = false }: { look: CategoryLook; className?: string; eager?: boolean }) {
  const demo=lookPreviewId(look.id);
  return <img style={look.id==="studio-offset"?{objectFit:"contain",transform:"translateX(-8%) scale(.82)"}:undefined} src={"/looks/" + demo + ".webp"} alt={look.title + " — illustrative demo"} width={640} height={640} loading={eager ? "eager" : "lazy"} decoding="async" className={"look-image " + className} />;
}
