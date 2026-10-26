import { notFound } from "next/navigation";
import { getWebContext } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { formatDate, money } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata = { title: "Invoice" };

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getWebContext();
  const { id } = await params;
  if (!ctx) notFound();
  let q = admin().from("invoices").select("*").eq("id", id);
  if (!ctx.platformRole) q = q.eq("organization_id", ctx.orgId);
  const { data: inv } = await q.maybeSingle();
  if (!inv) notFound();
  const s = inv.seller as Record<string, string>;
  const b = inv.buyer as Record<string, string | null>;
  const tax = inv.tax as { cgstPaise: number; sgstPaise: number; igstPaise: number; ratePercent: number; inWords: string };
  const lines = inv.lines as { description: string; sac: string; quantity: number; rateMinor: number; discountMinor: number; taxableMinor: number }[];
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-line bg-white p-8 text-[14px] print:border-0 print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton /></div>
      <div className="flex items-start justify-between border-b border-ink pb-4">
        <div>
          <div className="text-lg font-semibold">{s.legalName || s.tradeName}</div>
          {s.tradeName && s.legalName && <div>Trade name: {s.tradeName}</div>}
          <div className="whitespace-pre-line text-ink-2">{s.address}</div>
          {s.gstin && <div>GSTIN: <b>{s.gstin}</b></div>}
          {s.email && <div>{s.email} {s.phone && `· ${s.phone}`}</div>}
        </div>
        <div className="text-right">
          <div className="display text-3xl">Tax Invoice</div>
          <div className="mt-1">No. <b>{inv.number}</b></div>
          <div>Date: {formatDate(inv.issued_at)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 border-b border-line py-4">
        <div>
          <div className="eyebrow mb-1">Billed to</div>
          <div className="font-medium">{b.name}</div>
          {b.address && <div className="whitespace-pre-line text-ink-2">{b.address}</div>}
          {b.gstin && <div>GSTIN: {b.gstin}</div>}
        </div>
        <div>
          <div className="eyebrow mb-1">Place of supply</div>
          <div>{b.placeOfSupply}</div>
          <div className="mt-2 eyebrow mb-1">Reverse charge</div>
          <div>No</div>
        </div>
      </div>
      <table className="mt-4 w-full">
        <thead><tr className="border-b border-line text-left text-xs text-mute"><th className="py-2">Description</th><th>SAC</th><th className="text-right">Rate</th><th className="text-right">Discount</th><th className="text-right">Taxable value</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-line align-top"><td className="py-2 pr-4">{l.description}</td><td>{l.sac}</td><td className="text-right">{money(l.rateMinor)}</td><td className="text-right">{l.discountMinor ? money(l.discountMinor) : "-"}</td><td className="text-right">{money(l.taxableMinor)}</td></tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-4 w-72 space-y-1">
        {tax.cgstPaise > 0 && <div className="flex justify-between"><dt>CGST @ {tax.ratePercent / 2}%</dt><dd>{money(tax.cgstPaise)}</dd></div>}
        {tax.sgstPaise > 0 && <div className="flex justify-between"><dt>SGST @ {tax.ratePercent / 2}%</dt><dd>{money(tax.sgstPaise)}</dd></div>}
        {tax.igstPaise > 0 && <div className="flex justify-between"><dt>IGST @ {tax.ratePercent}%</dt><dd>{money(tax.igstPaise)}</dd></div>}
        <div className="flex justify-between border-t border-ink pt-1 text-base font-semibold"><dt>Total</dt><dd>{money(inv.total_minor, inv.currency)}</dd></div>
      </dl>
      <p className="mt-3 text-right text-xs">{tax.inWords}</p>
      <p className="mt-10 text-xs text-mute">Prepaid credits for AI-generated product images. This is a computer-generated invoice and does not need a signature.</p>
    </div>
  );
}
