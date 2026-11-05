/**
 * Shared primitives for the versioned shoot contracts (Phase 1, pack file 03 §2).
 * Pure TypeScript so the same code runs in the browser, the API and the worker.
 */

export const CONTRACT_VERSION = "2026-11-05.contracts-1" as const;

/** A machine-readable problem found before any paid work. `path` points at the offending field. */
export interface ContractIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ContractIssue[];
}

export const result = (issues: ContractIssue[]): ValidationResult => ({ ok: issues.length === 0, issues });

/** JSON with sorted keys, so equal content always produces the same string. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + stableStringify(v)).join(",") + "}";
}

/**
 * 64-bit FNV-1a content fingerprint as 16 hex characters. Detects any change to a contract;
 * it is an integrity identifier, not a security signature.
 */
export function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c ^ (h1 >>> 7), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** Customer-supplied or read-from-photo text. Kept as data and never treated as instructions. */
export interface UntrustedText {
  untrusted: true;
  text: string;
}

export const untrusted = (text: string, max = 600): UntrustedText => ({ untrusted: true, text: text.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) });

export const ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
