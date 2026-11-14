import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BabyLab } from "@/app/app/baby/baby-lab";
import "@/app/app/baby/baby.css";

export const dynamic = "force-dynamic";

/** Design preview with example data, like the other /dev pages. Off unless PREVIEW_UI=1. */
export default function DevBaby() {
  if (process.env.PREVIEW_UI !== "1") notFound();
  return (
    <AppShell locale="en" orgName="Demo workspace" orgs={[]} orgId="x" credits={12} email="demo@example.com" isPlatform>
      <BabyLab live={false} />
    </AppShell>
  );
}
