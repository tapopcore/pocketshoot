import { OUTPUT_LIST, STYLE_LIST } from "@packshot/core";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import { Card, Empty, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { deleteBrandKit, saveBrandKit } from "../actions";

export const metadata = { title: "Brand kits" };

export default async function Brand() {
  const ctx = await requireWeb();
  const { data: kits } = await admin().from("brand_kits").select("*").eq("organization_id", ctx.orgId).order("created_at");
  const logos = await signedUrls("brand", (kits ?? []).map((k) => k.logo_key).filter(Boolean), 3600);
  return (
    <div>
      <PageHeader eyebrow="Consistency" title="Brand kits">Save your colours and favourite look so every shoot matches. Pick a kit when you start a shoot.</PageHeader>
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4">
          {(kits ?? []).length === 0 && <Empty title="No brand kits yet">Add your brand colours on the right.</Empty>}
          {(kits ?? []).map((k) => (
            <Card key={k.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {k.logo_key && logos[k.logo_key] && <img src={logos[k.logo_key]} alt="" className="size-12 rounded-md border border-line object-contain p-1" />}
                  <div>
                    <div className="font-medium">{k.name}</div>
                    <div className="frame-no">{STYLE_LIST.find((s) => s.id === k.default_style)?.name ?? "Any style"} · {OUTPUT_LIST.find((o) => o.id === k.default_output)?.name ?? "Any size"}</div>
                  </div>
                </div>
                <form action={deleteBrandKit}><input type="hidden" name="id" value={k.id} /><button className="text-sm text-mute underline">Delete</button></form>
              </div>
              <div className="mt-4 flex gap-1.5">{(k.palette as string[]).map((c) => <span key={c} className="h-8 flex-1 rounded" style={{ background: c }} title={c} />)}</div>
              {k.style_rules && <p className="mt-3 text-sm text-mute">{k.style_rules}</p>}
            </Card>
          ))}
        </div>
        <Card className="h-fit p-5">
          <h2 className="display text-2xl">New brand kit</h2>
          <ActionForm action={saveBrandKit} submit="Save kit" resetOnSuccess className="mt-4 space-y-3">
            <Field label="Name"><Input name="name" required placeholder="Main brand" /></Field>
            <Field label="Colours" hint="Hex codes separated by commas, e.g. #1d3b2a, #e8ddd3, #c0392b"><Input name="palette" placeholder="#1d3b2a, #e8ddd3" /></Field>
            <Field label="Logo (optional)" hint="Kept for reference. It is never painted onto your products."><Input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="pt-2" /></Field>
            <Field label="Default style"><Select name="defaultStyle" defaultValue=""><option value="">None</option>{STYLE_LIST.filter((s) => s.id !== "custom").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label="Default size"><Select name="defaultOutput" defaultValue=""><option value="">None</option>{OUTPUT_LIST.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
            <Field label="Notes for your team"><Textarea name="styleRules" maxLength={600} placeholder="Always warm tones. No props on marketplace images." /></Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
