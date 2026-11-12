import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/baby/gate";
import "./baby.css";

export const metadata: Metadata = { title: "Baby Shoot · test lab", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#faf5ef", width: "device-width", initialScale: 1 };
export const dynamic = "force-dynamic";

export default function BabyLayout({ children }: { children: React.ReactNode }) {
  if (!labEnabled()) notFound();
  return <div className="bb">{children}</div>;
}
