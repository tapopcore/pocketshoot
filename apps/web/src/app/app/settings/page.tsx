import { INDIAN_STATES } from "@packshot/core";
import { hasRole, requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { requestDeletion, saveNotifications, saveSettings } from "../actions";

export const metadata = { title: "Settings" };

function Toggle({ name, title, text, on, first }: { name: string; title: string; text: string; on: boolean; first?: boolean }) {
  return <label className={"tr" + (first ? " f" : "")}><div><b>{title}</b><span>{text}</span></div><input type="checkbox" name={name} defaultChecked={on} className="tgl" /></label>;
}

export default async function Settings() {
  const ctx = await requireWeb();
  const db = admin();
  const [{ data: org }, { data: me }] = await Promise.all([
    db.from("organizations").select("*").eq("id", ctx.orgId).single(),
    ctx.userId ? db.from("profiles").select("notify_ready, notify_low_credits, notify_news").eq("id", ctx.userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const canEdit = hasRole(ctx, "admin");
  return (
    <div className="pg-settings">
      <PageHeader title="Settings">Workspace, billing details and notifications.</PageHeader>
      <div className="stg">
        <nav className="snav d-only" aria-label="Settings sections">{[["ws", "Workspace"], ["billing", "Billing details"], ["notify", "Notifications"], ...(ctx.role === "owner" ? [["delete", "Delete workspace"]] : [])].map(([id, l]) => <a key={id} href={"#" + id}>{l}</a>)}</nav>
        <div style={{ display: "grid", gap: "var(--s4)", minWidth: 0 }}>
          {!canEdit && <div className="note">Only owners and admins can change workspace and billing details.</div>}
          <ActionForm action={saveSettings} submit="Save workspace and billing" variant="accent" className="stack">
            <fieldset disabled={!canEdit} style={{ display: "grid", gap: "var(--s4)", border: 0, padding: 0, minWidth: 0 }}>
              <section id="ws" className="card pl"><h2 className="h4">Workspace</h2>
                <div className="g2">
                  <Field label="Workspace name"><Input name="name" defaultValue={org.name} required /></Field>
                  <Field label="Business type"><Select name="businessType" defaultValue={org.business_type ?? ""}><option value="">Choose one</option>{["Manufacturer", "Wholesaler or distributor", "Exporter", "D2C brand", "Marketplace seller", "Agency or studio", "Retailer", "Other"].map((b) => <option key={b}>{b}</option>)}</Select></Field>
                  <Field label="Language" hint="Hindi covers the main screens."><Select name="preferredLanguage" defaultValue={ctx.locale}><option value="en">English</option><option value="hi">हिन्दी (Hindi)</option></Select></Field>
                </div>
              </section>
              <section id="billing" className="card pl"><h2 className="h4">Billing details</h2><p className="sm muted" style={{ marginTop: 4 }}>These appear on your GST invoices.</p>
                <div className="g2">
                  <Field label="Business name"><Input name="billingName" defaultValue={org.billing_name ?? ""} /></Field>
                  <Field label="GSTIN" hint="Optional"><Input name="billingGstin" defaultValue={org.billing_gstin ?? ""} maxLength={15} /></Field>
                  <Field label="State"><Select name="billingStateCode" defaultValue={org.billing_state_code ?? ""}><option value="">Choose</option>{Object.entries(INDIAN_STATES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
                  <Field label="Address"><Textarea name="billingAddress" defaultValue={org.billing_address ?? ""} maxLength={400} style={{ minHeight: 54 }} /></Field>
                </div>
              </section>
            </fieldset>
          </ActionForm>

          <section id="notify" className="card pl"><h2 className="h4">Notifications</h2><p className="sm muted" style={{ marginTop: 4 }}>Emails sent to {ctx.email ?? "you"}.</p>
            <ActionForm action={saveNotifications} submit="Save notifications" variant="primary">
              <Toggle first name="ready" title="Photos are ready" text="When a shoot finishes, with a link to your photos" on={me?.notify_ready ?? true} />
              <Toggle name="low" title="Low on credits" text="When your workspace has fewer than 5 credits left" on={me?.notify_low_credits ?? true} />
              <Toggle name="news" title="Product news" text="New styles and features, about once a month" on={me?.notify_news ?? false} />
            </ActionForm>
          </section>

          {ctx.role === "owner" && <section id="delete" className="card pl danger">
            <h2 className="h4" style={{ color: "var(--bad)" }}>Delete workspace</h2>
            <p className="sm muted" style={{ marginTop: 4 }}>We delete your product photos, generated photos and team access. Invoices are kept for 8 years because tax law requires it. Unused credits are not refunded.</p>
            <ActionForm action={requestDeletion} submit="Delete workspace" variant="danger" className="del">
              <Field label='Type "DELETE" to confirm'><Input name="confirm" autoComplete="off" /></Field>
            </ActionForm>
          </section>}
        </div>
      </div>
    </div>
  );
}
