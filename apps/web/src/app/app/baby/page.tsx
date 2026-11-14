import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWeb } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { BabyLab } from "./baby-lab";
import "./baby.css";

export const metadata: Metadata = { title: "Baby Shoot", robots: { index: false, follow: false } };

/**
 * Baby Shoot inside the signed-in app. Platform accounts only for now:
 * it does not charge credits yet, so it must not be open to customers.
 */
export default async function BabyPage() {
  const ctx = await requireWeb();
  if (!ctx.platformRole) notFound();
  return <BabyLab live={integrations.openai} />;
}
