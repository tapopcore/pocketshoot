/**
 * Response shapes the app screens consume (checklist B10). Frontend and backend both import these,
 * so the mobile prototype (Phase 2) and the engine (Phases 3–5) cannot drift into invented fields.
 */
import type { AspectRatio } from "./common";
import type { ViewRole } from "./product-evidence";
import type { GoalFamily, Offering } from "./shoot-goal";
import type { SlotPurpose } from "./shot-plan";
import type { FailurePresentation, ItemState } from "./settlement";
import type { ResolutionProfile } from "./quote";

export interface SourcePhotoDTO { assetId: string; viewRole: ViewRole; thumbUrl: string; fullUrl: string; width: number; height: number }

/** Short product understanding shown before choosing a shoot (pack 02 §3). */
export interface ProductSummaryDTO {
  productId: string;
  name: string;
  summary: string;
  preserveLine: string;
  collectionLabel: string;
  sources: SourcePhotoDTO[];
  /** Only ambiguities that change what is sold, e.g. "Include the green shirt?" */
  inventoryQuestions: { entityId: string; question: string }[];
  /** Plain statements of what the photos cannot prove, e.g. "Back of the shirt not shown." */
  unknowns: string[];
}

export type FeasibilityDTO =
  | { status: "feasible"; quantity: number }
  | { status: "smaller_set_available"; requested: number; feasible: number; unlock: { view: ViewRole; ask: string }[] }
  | { status: "needs_reference"; ask: string; view?: ViewRole; example?: string }
  | { status: "needs_confirmation"; question: string }
  | { status: "unsupported"; reason: string };

export interface QuoteDTO {
  quoteId: string;
  offering: Offering;
  family: GoalFamily;
  quantity: number;
  aspectRatio: AspectRatio;
  slots: { purpose: SlotPurpose; label: string }[];
  totalCredits: number;
  balance: number;
  resolution: ResolutionProfile;
  expiresAt: string;
  /** "fresh" normally; "expired" means refresh before confirming. */
  freshness: "fresh" | "expired";
}

export interface ResultItemDTO {
  itemId: string;
  index: number;
  purpose: SlotPurpose;
  label: string;
  state: ItemState;
  /** Present for accepted and review states. */
  output?: { thumbUrl: string; fullUrl: string; width: number; height: number; nativeLongEdge: number };
  failure?: FailurePresentation;
  /** Review is held, never shown with an "approved" badge. */
  reviewNote?: string;
  credit: "reserved" | "charged" | "held" | "released";
}

export interface JobResultDTO {
  jobId: string;
  productName: string;
  offering: Offering;
  family: GoalFamily;
  aspectRatio: AspectRatio;
  sourceThumbs: SourcePhotoDTO[];
  items: ResultItemDTO[];
  /** Counts derived from items so headers never disagree with tiles. */
  summary: { accepted: number; review: number; failed: number; inProgress: number; charged: number };
  safeToLeave: boolean;
}

export function summarise(items: ResultItemDTO[]): JobResultDTO["summary"] {
  return {
    accepted: items.filter((i) => i.state === "accepted").length,
    review: items.filter((i) => i.state === "review").length,
    failed: items.filter((i) => i.state === "failed").length,
    inProgress: items.filter((i) => ["queued", "generating", "checking"].includes(i.state)).length,
    charged: items.filter((i) => i.credit === "charged").length,
  };
}
