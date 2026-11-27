import "server-only";
import { getSettings } from "@/lib/settings";

/** Who sells Baby Shoot. Comes from the seller settings in admin, so invoices and the public pages always agree. */
export async function babyBusiness() {
  const s = (await getSettings()).seller;
  const digits = (s.phone || "").replace(/\D/g, "");
  return {
    brand: "Baby Shoot",
    legalName: s.legalName || "",
    gstin: s.gstin || "",
    address: s.address || "",
    email: s.email || "",
    phone: s.phone || "",
    whatsapp: digits.length >= 10 ? (digits.length === 10 ? `91${digits}` : digits) : "",
  };
}
