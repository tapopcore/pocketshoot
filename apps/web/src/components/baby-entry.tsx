/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** The way into Baby Shoot from the app home. */
export function BabyEntry({ image }: { image: string }) {
  return (
    <Link href="/app/baby" style={{ display: "flex", alignItems: "center", gap: 14, padding: 10, paddingRight: 16, borderRadius: 20, background: "#faf5ef", border: "1px solid #e6dace", color: "#2a2026", textDecoration: "none", marginBottom: 16 }}>
      <img src={image} alt="" width={64} height={80} style={{ width: 64, height: 80, objectFit: "cover", borderRadius: 14, flex: "none" }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <b style={{ display: "block", fontSize: 17, lineHeight: 1.2 }}>Baby <i style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 500, color: "#a3405f" }}>Shoot</i> <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#f7e6ec", color: "#a3405f", verticalAlign: "middle", fontStyle: "normal" }}>New</span></b>
        <span style={{ display: "block", fontSize: 13, color: "#75666c", marginTop: 3 }}>A studio newborn shoot from a phone photo</span>
      </span>
      <ArrowRight size={20} aria-hidden style={{ flex: "none", color: "#a3405f" }} />
    </Link>
  );
}
