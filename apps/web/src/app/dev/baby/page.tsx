import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BabyLab } from "@/app/app/baby/baby-lab";
import { BABY_THEMES } from "@/lib/baby/themes";
import "@/app/app/baby/baby.css";

export const dynamic = "force-dynamic";

/** Design preview with example data, like the other /dev pages. Off unless PREVIEW_UI=1. */
export default async function DevBaby({ searchParams }: { searchParams: Promise<{ ex?: string }> }) {
  if (process.env.PREVIEW_UI !== "1") notFound();
  // ?ex=1 fills most cards with a stand-in picture so the card layout can be checked.
  const examples = (await searchParams).ex === "1" ? Object.fromEntries(BABY_THEMES.slice(0, 26).map((t) => [t.id, "/directions/hero.webp"])) : {};
  return (
    <AppShell locale="en" orgName="Demo workspace" orgs={[]} orgId="x" credits={12} email="demo@example.com" isPlatform>
      <BabyLab live={false} examples={examples} canManage />
    </AppShell>
  );
}
