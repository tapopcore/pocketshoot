/* eslint-disable @next/next/no-img-element -- signed storage URLs, already sized by the server */
/**
 * Shows the whole photo inside any box: the photo is fitted (never cropped) on a neutral surface, so products and models are never cut off or duplicated.
 */
export function FitImg({ src, alt = "", className, eager }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  return <>
    <img src={src} alt={alt} className={["fit-fg", className].filter(Boolean).join(" ")} loading={eager ? "eager" : "lazy"} decoding="async" />
  </>;
}
