/**
 * ProductEvidence: what is being sold, and which uploaded photos prove it (pack 03 §2, checklist C01–C06, B08).
 * Facts and entities point at stable asset IDs and checksums, never at array positions.
 */
import { CONTRACT_VERSION, fingerprint, result, type ContractIssue, type ValidationResult } from "./common";

export const VIEW_ROLES = ["front", "angle", "side", "back", "detail", "top", "bottom", "interior", "other"] as const;
export type ViewRole = (typeof VIEW_ROLES)[number];

export interface SourceAsset {
  assetId: string;
  storageKey: string;
  checksum: string;
  viewRole: ViewRole;
  width: number;
  height: number;
  /** Increments whenever this photo is replaced or its view role changes. */
  uploadRevision: number;
}

/** How each visible object relates to the sale. Only merchandise and included accessories are sold. */
export const ENTITY_ROLES = ["merchandise", "included_accessory", "retail_packaging", "removable_tag", "support", "reflection", "background", "hand", "unknown"] as const;
export type EntityRole = (typeof ENTITY_ROLES)[number];
export const SOLD_ROLES: readonly EntityRole[] = ["merchandise", "included_accessory"];

export interface Entity {
  entityId: string;
  role: EntityRole;
  label: string;
  /** Pieces of this entity in the sale, e.g. 2 for a pair of caps. Unknown stays undefined. */
  quantity?: number;
  sourceAssetIds: string[];
  /** Seller decided this, rather than the analysis. */
  sellerConfirmed?: boolean;
  /** For removable tags and packaging: whether they must stay in finished photos. */
  keepInPhotos?: boolean;
  /** Relation to another entity, e.g. a cap that belongs to the bottle. */
  partOf?: string;
}

export const REFERENCE_FORMS = ["flat", "folded", "hanging", "worn", "assembled", "object", "packaged", "unknown"] as const;
export type ReferenceForm = (typeof REFERENCE_FORMS)[number];
export const CONSTRUCTIONS = ["stitched", "unstitched", "semi_stitched", "not_applicable", "unknown"] as const;
export type Construction = (typeof CONSTRUCTIONS)[number];

export const FACT_KINDS = ["identity", "variant", "flavour", "fragrance", "ingredient", "benefit", "material", "construction", "finish", "use", "dimension", "claim", "colour", "text"] as const;
export type FactKind = (typeof FACT_KINDS)[number];
/** visible = seen; readable = legible printed text; seller_confirmed = the customer said so; inferred = a model guess. */
export const PROVENANCES = ["visible", "readable", "seller_confirmed", "inferred"] as const;
export type Provenance = (typeof PROVENANCES)[number];

export interface Fact {
  factId: string;
  kind: FactKind;
  statement: string;
  sourceAssetIds: string[];
  /** Normalised [x, y, w, h] in the first source asset, when localised. */
  region?: [number, number, number, number];
  certainty: "high" | "medium" | "low";
  provenance: Provenance;
}

/** A physical state of a component that a photo actually shows, e.g. cap on / cap off. */
export interface ComponentConfiguration {
  configId: string;
  entityId: string;
  component: string;
  state: string;
  sourceAssetIds: string[];
}

export const LOCK_KINDS = ["design", "piece_count", "silhouette", "colour", "motif", "fastener", "hardware", "label", "component_geometry", "other"] as const;
export type LockKind = (typeof LOCK_KINDS)[number];
export interface Lock { kind: LockKind; detail: string; sourceAssetIds: string[] }

export const TRANSFORMATIONS = ["reposition", "place_in_scene", "unfold", "redrape", "wear", "hold", "apply", "pour", "open", "remove_tag", "remove_packaging", "show_component_state"] as const;
export type Transformation = (typeof TRANSFORMATIONS)[number];

/** supported = the photos justify it; needs_reference = a specific photo is missing;
 * needs_confirmation = the seller must answer one question; unsupported = cannot be done truthfully. */
export const PERMISSION_STATUSES = ["supported", "needs_reference", "needs_confirmation", "unsupported"] as const;
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

export interface TransformationPermission {
  transformation: Transformation;
  status: PermissionStatus;
  /** Plain-language reason shown to the customer when not supported. */
  reason: string;
  /** For needs_reference: the exact photo to ask for. */
  requiredView?: ViewRole;
  requiredConfiguration?: { component: string; state: string };
  /** For needs_confirmation: the one question to ask. */
  question?: string;
}

export interface ProductEvidence {
  schemaVersion: typeof CONTRACT_VERSION;
  productId: string;
  /** Increments on any change to sources, roles, corrections or schema. Quotes and plans bind to it. */
  evidenceRevision: number;
  sources: SourceAsset[];
  identity: {
    category: string;
    collection: string;
    subcategory?: string;
    construction: Construction;
    referenceForm: ReferenceForm;
    shape?: string;
    materials: string[];
    colours: string[];
    pattern?: string;
  };
  entities: Entity[];
  facts: Fact[];
  configurations: ComponentConfiguration[];
  locks: Lock[];
  transformations: TransformationPermission[];
  unknowns: string[];
  analysis: { model: string; promptVersion: string; analysedAt: string };
}

/** Stable identity of the sources: changes when a photo is replaced, added, removed or relabelled. */
export function sourceFingerprint(sources: SourceAsset[]): string {
  return fingerprint([...sources].sort((a, b) => (a.assetId < b.assetId ? -1 : 1)).map((s) => [s.assetId, s.checksum, s.viewRole, s.uploadRevision]));
}

/** Cached analysis may be reused only when the exact sources, roles and schema still match (C05). */
export function evidenceIsCurrent(evidence: ProductEvidence, current: SourceAsset[], schemaVersion: string = CONTRACT_VERSION): boolean {
  return evidence.schemaVersion === schemaVersion && sourceFingerprint(evidence.sources) === sourceFingerprint(current);
}

export const soldEntities = (e: ProductEvidence) => e.entities.filter((x) => SOLD_ROLES.includes(x.role));
export const permission = (e: ProductEvidence, t: Transformation) => e.transformations.find((p) => p.transformation === t);
export const hasConfiguration = (e: ProductEvidence, component: string, state: string) => e.configurations.some((c) => c.component === component && c.state === state && c.sourceAssetIds.length > 0);

/** Structural validation: every reference resolves, provenance is honest, nothing is silently merchandise. */
export function validateEvidence(e: ProductEvidence): ValidationResult {
  const issues: ContractIssue[] = [];
  if (e.schemaVersion !== CONTRACT_VERSION) issues.push({ code: "schema_version", message: "Evidence was produced for another contract version.", path: "schemaVersion" });
  if (!e.sources.length) issues.push({ code: "no_sources", message: "At least one product photo is required.", path: "sources" });
  const ids = new Set(e.sources.map((s) => s.assetId));
  if (ids.size !== e.sources.length) issues.push({ code: "duplicate_asset", message: "Source asset IDs must be unique.", path: "sources" });
  for (const s of e.sources) if (!s.checksum) issues.push({ code: "missing_checksum", message: "Every source needs a content checksum.", path: "sources." + s.assetId });
  const refs = (list: string[], path: string) => {
    if (!list.length) issues.push({ code: "unsourced", message: "This claim does not cite a source photo.", path });
    for (const id of list) if (!ids.has(id)) issues.push({ code: "unknown_asset", message: `Unknown source asset ${id}.`, path });
  };
  const entityIds = new Set(e.entities.map((x) => x.entityId));
  e.entities.forEach((x, i) => {
    refs(x.sourceAssetIds, `entities.${i}`);
    if (x.partOf && !entityIds.has(x.partOf)) issues.push({ code: "unknown_entity", message: `partOf references unknown entity ${x.partOf}.`, path: `entities.${i}.partOf` });
  });
  if (!soldEntities(e).length) issues.push({ code: "no_merchandise", message: "Evidence must identify what is being sold.", path: "entities" });
  e.facts.forEach((f, i) => {
    refs(f.sourceAssetIds, `facts.${i}`);
    // A named scent or flavour is never proof of an ingredient (pack 03 §2).
    if (f.kind === "ingredient" && !["readable", "seller_confirmed"].includes(f.provenance)) issues.push({ code: "ingredient_not_evidenced", message: "Ingredients must be read from the label or confirmed by the seller.", path: `facts.${i}` });
    if (f.region && f.region.some((v) => v < 0 || v > 1)) issues.push({ code: "bad_region", message: "Regions are normalised to 0..1.", path: `facts.${i}.region` });
  });
  e.configurations.forEach((c, i) => {
    refs(c.sourceAssetIds, `configurations.${i}`);
    if (!entityIds.has(c.entityId)) issues.push({ code: "unknown_entity", message: `Configuration references unknown entity ${c.entityId}.`, path: `configurations.${i}` });
  });
  e.locks.forEach((l, i) => refs(l.sourceAssetIds, `locks.${i}`));
  for (const p of e.transformations) {
    if (p.status === "needs_reference" && !p.requiredView && !p.requiredConfiguration) issues.push({ code: "vague_reference_request", message: "A missing-reference answer must name the exact photo needed.", path: "transformations." + p.transformation });
    if (p.status === "needs_confirmation" && !p.question) issues.push({ code: "missing_question", message: "A confirmation answer must state the question.", path: "transformations." + p.transformation });
    if (p.status !== "supported" && !p.reason) issues.push({ code: "missing_reason", message: "Unsupported transformations need a plain reason.", path: "transformations." + p.transformation });
  }
  // Unstitched fabric cannot be worn as a finished garment (C10).
  const wear = permission(e, "wear");
  if (e.identity.construction === "unstitched" && wear?.status === "supported") issues.push({ code: "unstitched_worn", message: "Unstitched fabric cannot be shown as a finished worn garment.", path: "transformations.wear" });
  return result(issues);
}
