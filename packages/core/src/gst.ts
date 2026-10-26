/**
 * GST maths for invoices. Rates, SAC code and seller details come from admin
 * settings so the accountant can confirm them without a code change.
 * All money is handled in paise (integers).
 */

export const INDIAN_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Validates GSTIN format and its check digit. */
export function isValidGstin(raw: string): boolean {
  const g = raw.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  if (!(g.slice(0, 2) in INDIAN_STATES) && g.slice(0, 2) !== "97" && g.slice(0, 2) !== "99") return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(g[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  const check = GSTIN_CHARS[(36 - (sum % 36)) % 36];
  return check === g[14];
}

export interface TaxInput {
  /** Taxable value in paise (price before GST, after discount). */
  taxablePaise: number;
  sellerStateCode: string;
  /** Buyer's state code (from GSTIN or billing address). Null for buyers outside India. */
  buyerStateCode: string | null;
  ratePercent: number;
  /** When true, exports of services are invoiced without IGST under a Letter of Undertaking. */
  exportUnderLut?: boolean;
}

export interface TaxBreakdown {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalPaise: number;
  placeOfSupply: string;
  supplyType: "intra_state" | "inter_state" | "export";
}

export function computeGst(input: TaxInput): TaxBreakdown {
  const { taxablePaise, sellerStateCode, buyerStateCode, ratePercent } = input;
  if (!Number.isInteger(taxablePaise) || taxablePaise < 0) throw new Error("taxablePaise must be a non-negative integer");
  if (buyerStateCode === null) {
    const igst = input.exportUnderLut ? 0 : Math.round((taxablePaise * ratePercent) / 100);
    return {
      taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: igst, totalTaxPaise: igst,
      totalPaise: taxablePaise + igst, placeOfSupply: "96-Other Countries", supplyType: "export",
    };
  }
  const pos = `${buyerStateCode}-${INDIAN_STATES[buyerStateCode] ?? "Unknown"}`;
  if (buyerStateCode === sellerStateCode) {
    const half = Math.round((taxablePaise * ratePercent) / 200);
    return {
      taxablePaise, cgstPaise: half, sgstPaise: half, igstPaise: 0, totalTaxPaise: half * 2,
      totalPaise: taxablePaise + half * 2, placeOfSupply: pos, supplyType: "intra_state",
    };
  }
  const igst = Math.round((taxablePaise * ratePercent) / 100);
  return {
    taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: igst, totalTaxPaise: igst,
    totalPaise: taxablePaise + igst, placeOfSupply: pos, supplyType: "inter_state",
  };
}

/** Indian financial year label for a date, e.g. "2026-27". */
export function financialYear(d: Date): string {
  // IST offset so a payment at 00:30 IST on 1 April lands in the new year.
  const ist = new Date(d.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatInvoiceNumber(prefix: string, fy: string, seq: number): string {
  // GST rules cap invoice numbers at 16 characters.
  const n = `${prefix}/${fy.replace("-", "")}/${String(seq).padStart(5, "0")}`;
  if (n.length > 16) throw new Error(`Invoice number ${n} exceeds 16 characters; shorten the prefix`);
  return n;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(paise / 100);
}

/** Amount in words for invoices, Indian numbering. */
export function rupeesInWords(paise: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`);
  const three = (n: number) => {
    const h = Math.floor(n / 100), r = n % 100;
    return [h ? `${ones[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" ");
  };
  const words = (n: number): string => {
    if (n === 0) return "Zero";
    const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
    return [crore ? `${words(crore)} Crore` : "", lakh ? `${two(lakh)} Lakh` : "", thousand ? `${two(thousand)} Thousand` : "", rest ? three(rest) : ""]
      .filter(Boolean).join(" ");
  };
  const rupees = Math.floor(paise / 100), p = paise % 100;
  return `Rupees ${words(rupees)}${p ? ` and ${two(p)} Paise` : ""} Only`;
}
