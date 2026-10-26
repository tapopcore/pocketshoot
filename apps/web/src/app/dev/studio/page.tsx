import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Studio } from "@/app/app/new/studio";

/** UI preview harness for local screenshots. Disabled unless PREVIEW_UI=1. */
export default function DevStudio() {
  if (process.env.PREVIEW_UI !== "1") notFound();
  return (
    <AppShell locale="en" orgName="Demo workspace" orgs={[]} orgId="x" credits={12} email="demo@example.com" isPlatform={false}>
      <Studio locale="en" balance={12} isTrial={false} creativeEnabled maxImages={8} brandKits={[{ id: "k", name: "Brand", palette: ["#1d3b2a", "#c0392b", "#f4e1c1"] }]} existing={null}
        recentProducts={[{ id: "p1", name: "Rose serum", category: "beauty", coverUrl: "/dev-assets/photo.jpg" }]} />
    </AppShell>
  );
}
