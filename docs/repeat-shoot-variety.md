# Repeat-shoot variety — 1 November 2026

The previous implementation changed text seeds but kept studio directions static, lost history on same-photo reuploads and had no visual repetition check. This change reserves durable, per-workspace product-family editions before image spending. Same-photo reuploads connect through normalised photo checksums; new references on an existing product retain the family counter. Restarts and concurrent workers reuse the same job edition.

Each slot receives an explicit, persisted creative contract for layout, optical scale, light geometry, presentation and product-led world. Consecutive repeat roles change layout/light/scale, avoid recent contracts and do not reuse a composition-light pair within the six-pack. Studio directions now obey the fresh contract while preserving the selected supported viewpoint, exact design and mandatory white background. Thematic scenes remain newly authored, product-specific places and actions within the selected theme.

Previous deliverables stay inside the backend. A local DCT perceptual hash, spatial colour layout and palette comparison detects near-identical compositions before customer credits are captured. Re-encoding does not evade the check. Recovery runs the same check. No previous generated images are added to an external AI payload. Automatic approval review rejected that external-history option, so it was replaced with local comparison.

A rejected duplicate is retained for diagnosis and uses no customer credit. No automatic paid image regeneration is added. A provider may still bill the rejected attempt; the existing financial reservations remain in place. Local comparison detects near-duplicates, not every semantic or artistic similarity. Human visual QA remains necessary. No literal infinite or mathematically universal uniqueness claim is made.

Validation includes repeat-edition simulation, full studio contracts, tenant isolation, reupload matching, idempotent SQL reservations, perceptual duplicate detection and bounded live consecutive-pack checks. Prior private artifacts remain in private storage; only authorised backend access is used.
