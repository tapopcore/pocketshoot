import { getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { requirePlatform } from "@/lib/auth";
import { Card, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveFlagAction, saveSettingsAction, setPlatformRoleAction } from "../actions";

const HELP: Record<string, string> = {
  credit_policy: "Trial credits, watermark, free remakes, expiry months and max images per shoot.",
  providers: "generation: auto | gemini | openai | fal | mock. Model IDs, cost per image in USD (used when the provider doesn't report cost), concurrency and timeout.",
  quality: "Thresholds for the automatic checks. useJudge turns the Gemini accuracy review on or off.",
  seller: "Your legal entity, GSTIN, address, SAC code and invoice prefix. Confirm with your accountant.",
  shopify_billing: "test: true makes Shopify charges test charges (no money moves). Set false at launch.",
  fx_fallback: "Used only if the daily exchange-rate update fails.",
  retention: "Days before failed outputs are deleted.",
};

export default async function AdminSettings() {
  const ctx = await requirePlatform();
  const s = await getSettings(true);
  const { data: flags } = await admin().from("feature_flags").select("*").order("key");
  const readOnly = ctx.platformRole !== "platform_admin";
  return (
    <div>
      <PageHeader title="Settings & flags">Changes apply within 30 seconds, no deploy. Every save is written to the audit log.</PageHeader>
      {readOnly && <Notice className="mb-6">Support staff can view settings. Only platform admins can change them.</Notice>}
      {!s.seller.gstin && <Notice tone="warn" className="mb-6">Seller GSTIN is empty. Invoices will be issued without it. Fill in the seller block before taking real payments.</Notice>}
      <div className="grid gap-6 lg:grid-cols-2">
        {(Object.keys(HELP) as (keyof typeof s)[]).map((k) => (
          <Card key={k} className="p-5">
            <h2 className="font-mono text-sm">{k}</h2>
            <p className="mb-3 text-xs text-mute">{HELP[k]}</p>
            <ActionForm action={saveSettingsAction} submit="Save">
              <input type="hidden" name="key" value={k} />
              <Textarea name="value" defaultValue={JSON.stringify(s[k], null, 2)} className="min-h-48 font-mono text-xs" readOnly={readOnly} />
            </ActionForm>
          </Card>
        ))}
        <Card className="p-5">
          <h2 className="font-mono text-sm">feature_flags</h2>
          <p className="mb-3 text-xs text-mute">Scope is &quot;global&quot; or a workspace ID to override for one customer.</p>
          <table className="mb-4 w-full text-sm"><tbody>
            {(flags ?? []).map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="py-1.5 font-mono text-xs">{f.key}</td><td className="font-mono text-xs text-mute">{f.scope === "global" ? "global" : f.scope.slice(0, 8)}</td>
                <td><form action={saveFlagAction}><input type="hidden" name="key" value={f.key} /><input type="hidden" name="scope" value={f.scope} /><input type="hidden" name="value" value={String(!f.value)} /><button disabled={readOnly} className={`rounded-full px-3 py-0.5 text-xs ${f.value ? "bg-good text-white" : "border border-line"}`}>{f.value ? "on" : "off"}</button></form></td>
              </tr>
            ))}
          </tbody></table>
          <form action={saveFlagAction} className="flex flex-wrap gap-2">
            <Input name="key" placeholder="flag_key" className="!h-9 !w-36 text-sm" />
            <Input name="scope" placeholder="global" className="!h-9 !w-36 text-sm" />
            <Select name="value" className="!h-9 !w-24 text-sm"><option value="true">on</option><option value="false">off</option></Select>
            <button disabled={readOnly} className="rounded-full bg-ink px-4 text-sm text-paper">Add</button>
          </form>
        </Card>
        {!readOnly && (
          <Card className="p-5">
            <h2 className="font-mono text-sm">staff access</h2>
            <p className="mb-3 text-xs text-mute">Support can view and decide refunds and tickets. Admins can change money and settings. Leave the role empty to remove.</p>
            <ActionForm action={setPlatformRoleAction} submit="Update">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Email"><Input name="email" type="email" required /></Field>
                <Field label="Role"><Select name="role"><option value="platform_support">Support</option><option value="platform_admin">Admin</option><option value="">None</option></Select></Field>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
