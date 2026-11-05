# Phase 1: shared contracts and fixtures

Date: 5 November 2026 (IST). Branch `claude/phase1-contracts`, built on `claude/phase0-baseline` (production `c25eb0a` plus the Phase 0 docs and tests).

**Production and spend:** production unchanged. No migration, environment change, deployment or customer record was touched. **No paid image generation or AI review was run. Provider spend in this phase: ₹0.**

## What now exists

Versioned contracts live in `packages/core/src/contracts/` and are imported as `@packshot/core/contracts`. Each one is pure TypeScript, so the browser, the API and the worker can all run the same validation.

| File | Contract | What it enforces |
|---|---|---|
| `common.ts` | Versioning and fingerprints | `CONTRACT_VERSION`; stable content fingerprints; deep freeze; `UntrustedText` for customer and printed text |
| `product-evidence.ts` | ProductEvidence | Source assets bound by asset ID, checksum, view role and upload revision. Entity inventory roles: merchandise, included accessory, retail packaging, removable tag, support, reflection, background, hand. Facts with source, region, certainty and provenance (visible, readable, seller-confirmed, inferred). Component configurations such as cap on or spray head exposed. Locks. Permissions per transformation: supported, needs_reference, needs_confirmation, unsupported |
| `shoot-goal.ts` | ShootGoal | Three offerings (Studio photos, Model & everyday use, Creative campaign) and seven goal families. The goal is frozen and fingerprinted at confirmation; any change is a new revision. Feasibility against evidence reports missing photo, question and impossible as separate answers |
| `shot-plan.ts` | ShotPlan | Whole-set validation before a quote. Every slot meets the goal's human action and environment. Worn photos show the product worn. Clutter is never required merchandise. Removable tags leave worn photos. Revealed faces and component states need a real source. Actions the product doesn't afford (holding a vehicle, wearing fabric) are refused. Duplicates differing only by crop or light are refused. Quantity is never padded or silently shrunk. Props must cite a fact or declare a style reason |
| `review-verdict.ts` | ReviewVerdict | Eight dimensions; four are critical (goal, identity, components, label). The verdict is derived from the dimensions, so a reviewer cannot accept over a critical fail. Uncertainty means review, not accept. Fails must state visible evidence |
| `settlement.ts` | Item states and credits | `queued → generating → checking → accepted / review / failed`, plus cancelled and superseded. **Only accepted is charged; review is held; failed is released.** 14 distinct failure reasons, each with its own customer copy and recovery action. Retry only where it can help, and bounded |
| `quote.ts` | Quote | Binds price to goal fingerprint, evidence revision, plan revision and resolution profile, with native and delivered size kept separate. Expiry, changed choices, changed photos, changed plan, slot or total mismatch and insufficient credits are all rejected before credits are reserved |
| `dto.ts` | Screen responses | Product summary, feasibility, quote and job-result shapes the prototype and the engine both use, with header counts derived from the tiles |
| `fixtures.ts` | Fixtures | BONKERS (folded tee with tag, green garment, tissue and bedding); stitched flat shirt with a back photo; unstitched three-piece fabric; FEEO spray capped and uncapped, plus a variant without the uncapped photo; pen set; two-cap set; watermelon can (flavour fact and a guessed-ingredient negative); SUV; long product name; quotes (fresh, expired, insufficient); a six-tile result in every state |

## Tested

`npx vitest run` in `packages/core`: 154 tests pass, including 38 new contract tests. In `apps/web`: 159 pass, including one subpath import test. Typecheck: web passes; core has only the 1 known error in a test file. Production build passes, **and every `/app` route has the same first-load size as the baseline**. The contracts are a package subpath, so no client bundle grew. An earlier draft that re-exported them from the package root added 4–5 kB to `/app/new` and `/app/jobs/[id]`; it was replaced before commit.

Key cases proved at contract level (not yet in live code):
- **BONKERS:** six distinct model-worn photos from the folded front photo form a valid plan. The plan production actually ran on 3 Nov fails the goal on all six slots and is flagged for demanding the green garment.
- **Tags:** a retail tag in a worn photo is refused. A back view is refused without a back photo, and allowed for the shirt that has one.
- **FEEO:** the exposed spray-head detail is valid only while the uncapped photo exists. Remove it and the plan fails before any image is bought. A background bottle can never be required in frame.
- **Pens:** three diagonals that differ only by light are flagged as two duplicates.
- **Unstitched fabric and the SUV:** fabric can't be worn and the SUV can't be held, even when slipped into a campaign.
- **Beverage:** the readable watermelon flavour justifies watermelon props; an unknown fact doesn't; an ingredient guessed from colour invalidates the evidence.
- **Goals:** selected additions change the goal fingerprint, so a path that drops them is detectable. Tampering with a confirmed goal is detected.
- **Credits:** review holds and never captures. That is the contract fix for issue I6; the live pipeline is unchanged until Phase 5.

The Phase 0 characterization tests still pass, as they should: the live code is not changed yet.

## Not done in this phase

- Live paths do not use these contracts yet. Wiring them in is Phases 3–5, so issues I1–I14 remain open in production.
- B07, carrying the contract through single, Studio, Variety, batch, API, edit, retry and remake, is Phase 4/5 work.
- The 25 × 8 applicability matrix and per-category transformation rules are Phase 3.
- Fixtures describe evidence; they say nothing about image quality.

## Migration and rollback approach (for Phase 5, not executed)

1. **Additive only.** New nullable columns: `generation_jobs.contract jsonb` (goal snapshot, quote, plan reference) and `generation_items.slot jsonb` (slot contract, verdict). Evidence goes in `products.attributes.evidence` keyed by `schemaVersion`. `product_assets` already has `checksum`; add `upload_revision int default 1`. Nothing existing is altered or dropped.
2. **Two worlds side by side.** A job with `contract` set follows the new path. A job without it keeps today's behaviour, so historical and in-flight jobs are untouched.
3. **Credits.** A new `settle_item_v2` holds review outcomes. The existing `settle_item` stays as it is for legacy jobs and for rollback.
4. **Switch.** New-contract job creation sits behind the existing per-organisation feature flag (`getFlag`), turned on first for an internal workspace only.
5. **Rollback.** Turn the flag off, let in-flight new-contract jobs finish or cancel and release their credits, then redeploy the previous build. Because the columns are additive and old code ignores them, `c25eb0a` keeps working on the migrated schema. This compatibility is tested in PGlite before any production migration.

## Staging options (investigated, nothing bought or created)

Today there is no isolated environment. The only database is production, and preview builds have no database or OpenAI keys.

| Option | What it is | Cost | Limits |
|---|---|---|---|
| **A. Free (recommended now)** | A second Supabase project "pocketshoot-staging" on the existing Free organisation, which has 1 of 2 free active projects in use. Plus a `staging` Git branch on Vercel with branch-specific Preview environment variables (Hobby supports this). Image provider mocked; no OpenAI key in staging | **$0** | Free projects pause after 1 week idle (resume manually); 500 MB database, 1 GB storage; no backups. Enough for Gate 2 integration tests with mocks |
| B. Supabase Pro + branching | Upgrade the organisation to Pro and create short-lived database branches per test run, migrations applied from the repo | **$25/month** plan (includes $10 compute credit that does **not** cover branches), plus **$0.01344 per branch-hour** for Micro compute (about $0.32 a day, or about $9.80 a month if one branch runs nonstop), plus branch egress and storage | Branches are outside the spend cap. Also gives production daily backups and no idle pausing |
| C. Local only | Real migrations in in-process Postgres (PGlite, already used by `ledger.sql.test.ts`) for SQL settlement and budget tests | **$0** | Covers SQL; not auth, storage, worker or the deployed app. Docker is not available in this workspace for a full local Supabase |

**Recommendation:** use C for Phase 5 SQL correctness and A for integrated Gate 2 testing. Both are free. With your approval I would create the staging Supabase project and a `staging` branch, then set staging-only environment variables on that branch. None of this touches production.

**Two account risks found while checking** (not part of staging, but you should decide on them):
1. **Production Supabase is on the Free plan.** Free projects are paused after a week of inactivity and have no backups. A live customer product usually needs Pro ($25/month) for that reason alone.
2. **Vercel Hobby is for non-commercial, personal use only**, per Vercel's own plan page. PocketShoot charges customers, so the account should move to Pro ($20 per developer seat per month), which also adds one custom environment such as `staging`.

Sources: [Supabase pricing](https://supabase.com/pricing), [Supabase branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching), [Vercel environments and staging](https://vercel.com/docs/deployments/environments), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby).

## Next dependent phases

Phase 2 (mobile prototype on `dto.ts` and `fixtures.ts`) and Phase 3 (evidence and category rules on `product-evidence.ts` and `shoot-goal.ts`) can now start. They need no staging and no spend.
