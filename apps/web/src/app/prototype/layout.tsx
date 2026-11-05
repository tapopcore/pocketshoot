import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrototypeShell } from "@/components/prototype/shell";
import "@/styles/prototype.css";

export const metadata: Metadata = { title: "Prototype", robots: { index: false, follow: false } };

/** Phase 2 prototype on fixtures. Disabled unless PREVIEW_UI=1, exactly like the existing /dev harness. */
export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  if (process.env.PREVIEW_UI !== "1") notFound();
  return <Suspense><PrototypeShell>{children}</PrototypeShell></Suspense>;
}
