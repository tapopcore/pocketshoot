/* eslint-disable @next/next/no-img-element -- signed storage URLs, already sized by the server */
/**
 * Shows the whole photo inside any box: the photo is fitted (never cropped) and a soft,
 * blurred copy of it fills the empty space, so products and models are never cut off.
 */
export function FitImg({ src, alt = "", className, eager }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  return <>
    <img src={src} alt="" aria-hidden className="fit-bg" loading={eager ? "eager" : "lazy"} decoding="async" />
    <img src={src} alt={alt} className={["fit-fg", className].filter(Boolean).join(" ")} loading={eager ? "eager" : "lazy"} decoding="async" />
  </>;
}
