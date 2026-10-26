import { INDIAN_STATES } from "@packshot/core";
import { hasRole, requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Card, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { requestDeletion, saveSettings } from "../actions";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const ctx = await requireWeb();
  const { data: org } = await admin().from("organizations").select("*").eq("id", ctx.orgId).single();
  const canEdit = hasRole(ctx, "admin");
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={ctx.orgName} title="Settings" />
      {!canEdit && <Notice className="mb-6">Only admins can change workspace settings.</Notice>}
      <Card className="p-6">
        <ActionForm action={saveSettings} submit="Save settings" className="space-y-5">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Workspace name"><Input name="name" defaultValue={org.name} required /></Field>
              <Field label="Business type">
                <Select name="businessType" defaultValue={org.business_type ?? ""}>
                  <option value="">Choose one</option>
                  {["Manufacturer", "Wholesaler / distributor", "Exporter", "D2C brand", "Marketplace seller", "Agency / studio", "Retailer", "Other"].map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Language" hint="Hindi covers the main screens. More languages are on the way.">
              <Select name="preferredLanguage" defaultValue={ctx.locale}><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option></Select>
            </Field>
            <div className="border-t border-line pt-5">
              <div className="eyebrow mb-3">Billing details for invoices</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Legal / business name"><Input name="billingName" defaultValue={org.billing_name ?? ""} /></Field>
                <Field label="GSTIN (optional)"><Input name="billingGstin" defaultValue={org.billing_gstin ?? ""} maxLength={15} /></Field>
              </div>
              <Field label="Address" className="mt-4"><Textarea name="billingAddress" defaultValue={org.billing_address ?? ""} maxLength={400} className="min-h-20" /></Field>
              <Field label="State" className="mt-4">
                <Select name="billingStateCode" defaultValue={org.billing_state_code ?? ""}><option value="">Choose</option>{Object.entries(INDIAN_STATES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>
              </Field>
            </div>
          </fieldset>
        </ActionForm>
      </Card>

      {ctx.role === "owner" && (
        <Card className="mt-10 border-bad/30 p-6">
          <h2 className="display text-2xl">Delete workspace</h2>
          <p className="mt-1 text-sm text-mute">We delete your product photos, generated images and team access. Invoices are kept for 8 years because tax law requires it. Unused credits are not refunded.</p>
          <ActionForm action={requestDeletion} submit="Request deletion" variant="danger" className="mt-4">
            <Field label='Type "DELETE" to confirm'><Input name="confirm" autoComplete="off" /></Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
