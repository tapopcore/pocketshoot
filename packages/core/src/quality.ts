/**
 * Turns individual screening checks into PASS / REVIEW / FAIL.
 * These are screening signals, never a guarantee of accuracy.
 */

export type Decision = "pass" | "review" | "fail";

export type CheckType =
  | "dimensions"
  | "product_alignment"
  | "colour_delta"
  | "edge_coverage"
  | "vlm_judge"
  | "blank_output"
  | "human_realism"
  | "creative_quality"
  | "style_adherence";

export interface CheckResult {
  type: CheckType;
  /** 0..1 where 1 is best, or null when the check could not run. */
  score: number | null;
  decision: Decision;
  details: Record<string, unknown>;
}

export interface QualityThresholds {
  alignmentReview: number;
  alignmentFail: number;
  colourDeltaReview: number;
  colourDeltaFail: number;
}

export const DEFAULT_THRESHOLDS: QualityThresholds = {
  alignmentReview: 0.82,
  alignmentFail: 0.6,
  colourDeltaReview: 8,
  colourDeltaFail: 18,
};

export function aggregate(checks: CheckResult[]): Decision {
  if (checks.some((c) => c.decision === "fail")) return "fail";
  if (checks.some((c) => c.decision === "review")) return "review";
  return "pass";
}

export function alignmentDecision(score: number, t = DEFAULT_THRESHOLDS): Decision {
  if (score < t.alignmentFail) return "fail";
  if (score < t.alignmentReview) return "review";
  return "pass";
}

export function colourDecision(deltaE: number, t = DEFAULT_THRESHOLDS): Decision {
  if (deltaE > t.colourDeltaFail) return "fail";
  if (deltaE > t.colourDeltaReview) return "review";
  return "pass";
}

export interface JudgeVerdict {
  same_product: boolean;
  text_changed: boolean;
  logo_changed: boolean;
  colour_changed: boolean;
  shape_changed: boolean;
  extra_or_missing_items: boolean;
  artefacts: boolean;
  design_changed?: boolean;
  notes?: string;
}

export function judgeDecision(v: JudgeVerdict, mode: "preserve" | "creative"): Decision {
  if (!v.same_product) return "fail";
  const serious = [v.text_changed, v.logo_changed, v.design_changed, v.extra_or_missing_items].filter(Boolean).length;
  const minor = [v.colour_changed, v.shape_changed, v.artefacts].filter(Boolean).length;
  if (mode === "preserve" && serious > 0) return "review";
  if (serious + minor > 0) return "review";
  return "pass";
}

export function parseJudgeJson(text: string): JudgeVerdict | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const o = JSON.parse(match[0]);
    const keys = ["same_product", "text_changed", "logo_changed", "colour_changed", "shape_changed", "extra_or_missing_items", "artefacts"];
    if (!keys.every((k) => typeof o[k] === "boolean")) return null;
    return o as JudgeVerdict;
  } catch {
    return null;
  }
}

/** CIE76 delta E between two Lab colours. */
export function deltaE76(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** Pearson correlation of two equal-length greyscale arrays, restricted to a mask. */
export function maskedCorrelation(a: ArrayLike<number>, b: ArrayLike<number>, mask: ArrayLike<number>): number {
  let n = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) if (mask[i] > 127) { n++; sa += a[i]; sb += b[i]; }
  if (n < 16) return 0;
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) {
    if (mask[i] <= 127) continue;
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return va === vb ? 1 : 0;
  return cov / Math.sqrt(va * vb);
}
