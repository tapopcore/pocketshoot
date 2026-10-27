/**
 * Credit rules. The database is the source of truth (see SQL functions
 * reserve_credits / settle_job_credits), and this module mirrors the same
 * maths so the UI, tests and admin reports agree with it.
 *
 * Charging rule (decided, editable in admin settings):
 *  1. Submitting a job reserves one credit per requested image.
 *  2. An image that is delivered (quality PASS or REVIEW) captures one credit.
 *  3. Technical failures and automatic quality FAILs release the credit.
 *  4. Each delivered image includes `freeRemakes` free regenerations.
 *     Further regenerations reserve a new credit.
 *  5. A validated product-integrity report restores the captured credit.
 */

export type LotKind = "paid" | "promo" | "trial" | "restored" | "adjustment";

export type GrantEntryType = "purchase" | "promo" | "trial" | "adjustment_credit";
export type EntryType =
  | GrantEntryType
  | "reserve"
  | "release"
  | "capture"
  | "refund"
  | "expiry"
  | "chargeback"
  | "adjustment_debit";

export interface LedgerEntry {
  lotId: string;
  type: EntryType;
  quantity: number; // always positive; the type gives the direction
}

export interface Lot {
  id: string;
  kind: LotKind;
  expiresAt: string | null;
  createdAt: string;
}

export interface LotBalance {
  lotId: string;
  kind: LotKind;
  granted: number;
  available: number;
  reserved: number;
  consumed: number;
  expired: number;
  expiresAt: string | null;
}

export interface WalletBalance {
  available: number;
  reserved: number;
  consumed: number;
  expired: number;
  paidAvailable: number;
  promoAvailable: number;
  lots: LotBalance[];
}

const GRANT_TYPES: EntryType[] = ["purchase", "promo", "trial", "adjustment_credit"];

export function lotBalance(lot: Lot, entries: LedgerEntry[]): LotBalance {
  let granted = 0, reserve = 0, release = 0, capture = 0, refund = 0, expiry = 0, debit = 0;
  for (const e of entries) {
    if (e.lotId !== lot.id) continue;
    if (e.quantity < 0) throw new Error("Ledger quantities must be positive");
    if (GRANT_TYPES.includes(e.type)) granted += e.quantity;
    else if (e.type === "reserve") reserve += e.quantity;
    else if (e.type === "release") release += e.quantity;
    else if (e.type === "capture") capture += e.quantity;
    else if (e.type === "refund") refund += e.quantity;
    else if (e.type === "expiry") expiry += e.quantity;
    else if (e.type === "chargeback" || e.type === "adjustment_debit") debit += e.quantity;
  }
  return {
    lotId: lot.id,
    kind: lot.kind,
    granted,
    available: granted + refund - reserve + release - expiry - debit,
    reserved: reserve - release - capture,
    consumed: capture - refund,
    expired: expiry,
    expiresAt: lot.expiresAt,
  };
}

export function walletBalance(lots: Lot[], entries: LedgerEntry[], now = new Date()): WalletBalance {
  const balances = lots.map((l) => lotBalance(l, entries));
  const live = (b: LotBalance) => !b.expiresAt || new Date(b.expiresAt) > now;
  const sum = (f: (b: LotBalance) => number) => balances.reduce((a, b) => a + f(b), 0);
  return {
    available: sum((b) => (live(b) ? Math.max(0, b.available) : 0)),
    reserved: sum((b) => b.reserved),
    consumed: sum((b) => b.consumed),
    expired: sum((b) => b.expired),
    paidAvailable: sum((b) => (live(b) && b.kind === "paid" ? Math.max(0, b.available) : 0)),
    promoAvailable: sum((b) => (live(b) && b.kind !== "paid" ? Math.max(0, b.available) : 0)),
    lots: balances,
  };
}

/** Order in which lots are spent: promotional first, then soonest expiry, then oldest. */
export function spendOrder(a: LotBalance & { createdAt?: string }, b: LotBalance & { createdAt?: string }): number {
  const promoA = a.kind === "paid" ? 1 : 0;
  const promoB = b.kind === "paid" ? 1 : 0;
  if (promoA !== promoB) return promoA - promoB;
  const ea = a.expiresAt ? Date.parse(a.expiresAt) : Infinity;
  const eb = b.expiresAt ? Date.parse(b.expiresAt) : Infinity;
  if (ea !== eb) return ea - eb;
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

/** Plans which lots a reservation draws from. Returns null if there is not enough. */
export function planReservation(lots: Lot[], entries: LedgerEntry[], quantity: number, now = new Date()) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive integer");
  const created = new Map(lots.map((l) => [l.id, l.createdAt]));
  const usable = walletBalance(lots, entries, now)
    .lots.filter((b) => b.available > 0 && (!b.expiresAt || new Date(b.expiresAt) > now))
    .map((b) => ({ ...b, createdAt: created.get(b.lotId) }))
    .sort(spendOrder);
  let remaining = quantity;
  const plan: { lotId: string; quantity: number }[] = [];
  for (const b of usable) {
    if (remaining === 0) break;
    const take = Math.min(b.available, remaining);
    plan.push({ lotId: b.lotId, quantity: take });
    remaining -= take;
  }
  return remaining === 0 ? plan : null;
}

export interface CreditPolicy {
  creditsPerImage: number;
  freeRemakes: number;
  remakeWindowDays: number;
  trialCredits: number;
  /** Deprecated compatibility field. Image delivery never adds watermarks. */
  trialWatermark: boolean;
  paidExpiryMonths: number;
  promoExpiryDays: number;
  maxImagesPerJob: number;
}

export const DEFAULT_POLICY: CreditPolicy = {
  creditsPerImage: 1,
  freeRemakes: 1,
  remakeWindowDays: 7,
  trialCredits: 2,
  trialWatermark: false,
  paidExpiryMonths: 12,
  promoExpiryDays: 60,
  maxImagesPerJob: 8,
};

export function estimateCredits(imageCount: number, policy: CreditPolicy = DEFAULT_POLICY): number {
  if (!Number.isInteger(imageCount) || imageCount < 1) return 0;
  return imageCount * policy.creditsPerImage;
}

/** Whether a regenerate of an image is free under the remake policy. */
export function isFreeRemake(
  remakesUsed: number,
  deliveredAt: string | Date,
  policy: CreditPolicy = DEFAULT_POLICY,
  now = new Date(),
): boolean {
  const delivered = new Date(deliveredAt).getTime();
  const windowMs = policy.remakeWindowDays * 86_400_000;
  return remakesUsed < policy.freeRemakes && now.getTime() - delivered <= windowMs;
}

export function pricePerImage(pricePaise: number, credits: number): number {
  if (credits <= 0) return 0;
  return Math.round(pricePaise / credits) / 100;
}

/** Contribution per accepted image, from section 10 of the spec. All values in rupees. */
export function contributionPerAcceptedImage(opts: {
  netPricePerImage: number;
  providerCostPerAttempt: number;
  acceptanceRate: number;
  otherVariableCost: number;
}) {
  const effectiveCost = opts.providerCostPerAttempt / Math.max(opts.acceptanceRate, 0.01) + opts.otherVariableCost;
  const contribution = opts.netPricePerImage - effectiveCost;
  return {
    effectiveCost: round2(effectiveCost),
    contribution: round2(contribution),
    margin: opts.netPricePerImage > 0 ? round2((contribution / opts.netPricePerImage) * 100) : 0,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
