import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The Baby Shoot lab exists only where BABY_LAB_CODE is set (a branch preview).
 * With no code configured, every lab page and route answers 404, so production is unaffected.
 */
export function labEnabled() {
  return !!process.env.BABY_LAB_CODE?.trim();
}
export function labCodeOk(given: string | null) {
  const want = process.env.BABY_LAB_CODE?.trim();
  if (!want || !given) return false;
  const a = Buffer.from(given.trim()), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
