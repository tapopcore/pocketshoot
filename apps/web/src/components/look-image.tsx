/* eslint-disable @next/next/no-img-element -- locally sized, original demo photographs. */
import {lookPreviewId,type CategoryLook} from "@packshot/core";

/** Static examples, shared by every visitor. Never a paid preview of an upload. */
export function LookImage({ look, className = "", eager = false }: { look: CategoryLook; className?: string; eager?: boolean }) {
  const demo=lookPreviewId(look.id);
  return <img src={"/looks/" + demo + ".webp"} alt={look.title + ", example photo"} width={640} height={640} loading={eager ? "eager" : "lazy"} decoding="async" className={"look-image " + className} />;
}
