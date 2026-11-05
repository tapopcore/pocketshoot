# Phase 0: baseline, module map and issue register

Date: 5 November 2026 (IST). Integrator for this branch: Claude. Branch `claude/phase0-baseline`, created from production commit `c25eb0a`.

**Status of production and spend:** production unchanged. No deployment, environment variable, database write, credit or customer record was touched. Database access was SELECT only. **No paid image generation and no paid AI review was run: provider spend in this phase is ₹0.**

Sources read in full: the 23-page handover PDF (including the raw BONKERS photo, both Pocket Shoot screenshots and all 12 ChatGPT examples), the transfer brief, the verified audit, and pack files 00–05 plus the manifest. All eight manifest files match their published SHA-256 hashes and byte sizes. The checklist has 161 unchecked tasks, as the manifest states.

Every finding below is labelled with what kind of evidence supports it:
- **Observed incident:** stored production records.
- **Reproduced defect:** a characterization test in this branch.
- **Static risk:** read from code, not executed.
- **Hypothesis:** needs measurement.

---

## 1. Baseline manifest (A02, A03, A04)

| Item | Verified value |
|---|---|
| Production alias | pocketshoot.vercel.app → `dpl_3LCAE24VHwVfWZ2o6aYEsgkMzpas`, READY, target production, created 03 Nov 2026 19:59 IST |
| Production commit | `c25eb0a538abbb5c84c693efe571df86c7f1018c` ("Align migration history with applied database versions") |
| `redesign-v3` | `e1b5421d03520613c122c92d94ffa3dee54a7c34`, tree `b30caee67e96001e4c12b89e6d4d9443c49b2285`, identical to production |
| `main` (default) | `c1a0b8cb3280006ab36980cfb79a55e2d341c7ec` (28 Oct), tree `8c25fc67…`. Differs from production in 606 files; 57 of those are under `apps/web/src/lib` and `packages/core/src`. **Never deploy `main`.** |
| Other remote branches | None besides `main` and `redesign-v3` |
| New commits since the audit | None. Production and `redesign-v3` have not moved since 3 Nov |
| Local work to preserve | The earlier working checkout is clean. All of its commits, including the 1–2 Nov UI fixes, are ancestors of `c25eb0a` |
| Rollback candidates (Vercel) | `dpl_FUXBC2ibeTMpc5WWqfKuDX4TneKv` (7d3e319), `dpl_AWNdGkQtSsfBwEvGkPCc9ZpwvNn2` (5593826), plus older ones |
| Database | Supabase `vsgsoqofddqodbmarpkx` (ap-south-1). Live budget policy: `2026-11-03.pooled-average-2`, the only policy written since the deploy |
| Production env var names | `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (production only); `CRON_SECRET`, `ENCRYPTION_KEY` (production and preview); `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PLATFORM_ADMIN_EMAILS`, `SHOPIFY_API_VERSION` (all targets). Values not read. |
| Not configured | `RESEND_API_KEY`/`EMAIL_FROM` (no transactional email), Razorpay keys (checkout shows "Payments are being set up"), custom SMTP for sign-in (see I19) |
| Staging | **None exists.** Preview deployments have no service key or OpenAI key, and there is a single Supabase project, which is production. Gate 2 needs an isolated database and storage (see Decisions). |
| Repository instructions | Only `apps/mobile/AGENTS.md` (Expo rules, mobile app only). No root AGENTS.md or CLAUDE.md. `docs/` holds 8 Codex design notes; `nozzle-budget-recovery.md` records the FEEO fix and the pooled-budget design |
| Skills | `design-world-class-uiux` is not available in this session. The nearest available are `ui-ux-pro-max` and `frontend-design`; Phase 2 will say which it used |

## 2. Test baseline (A10)

Environment: Linux, Node 22.23.4, npm 10.9.9, clean `npm ci` in an isolated worktree at `c25eb0a`.

| Check | Command | Result |
|---|---|---|
| Core tests (existing) | `cd packages/core && npx vitest run` | 109 / 109 pass (matches audit) |
| Web tests (existing) | `cd apps/web && npx vitest run` | 147 / 147 pass (matches audit) |
| Characterization tests (new) | same commands | core +7, web +11; all reproduce their defect (116 and 158 total) |
| Web typecheck | `cd apps/web && npx tsc --noEmit` | pass |
| Core typecheck | `cd packages/core && npx tsc --noEmit` | **1 error**, in test file `campaign-direction.test.ts:5` (unsafe cast). Not production code |
| Lint | `cd apps/web && npx eslint src` | 0 errors, 8 warnings |
| Build | `npm run build` | compiled successfully, without production env |

Characterization files are `packages/core/src/handover-characterization.test.ts` and `apps/web/tests/handover-characterization.test.ts`. **A pass means the defect is still present.** Each fix must make its test fail and turn it into a corrected-behaviour regression in the same commit. No other code was changed.

## 3. Customer journey and module map (A05)

| Step | Entry point | Main code | Notes |
|---|---|---|---|
| Upload / camera | `/app/new`, `POST /api/uploads`, `/api/products` | `lib/products.ts` (`createUploadUrls` L26, `ingestUploads` L43, `addProductPhotos` L93, `updatePhotoView` L202); `app/app/new/studio.tsx` | View roles front/angle/side/back/detail exist; original viewer exists |
| Analysis | `POST /api/products/[id]/prepare` | `lib/prep.ts` `analyzeProduct` L160–193; `packages/core` `photographic-direction.ts`, `director.ts` | Cache keyed on photo count + `CREATIVE_VERSION` only (I12) |
| Eligibility / looks | studio step 3 | `packages/core/src/product-looks.ts` `lookEligibility` L2406, `packLooks` L2473 | 25 collections, 126 looks, 15 studio presets |
| Quote | `POST /api/jobs/quote` | `lib/cost-policy.ts`, `lib/jobs.ts` | Customer credits are separate from the provider budget |
| Create job | `POST /api/jobs`, `POST /api/batch` | `lib/jobs.ts` `createJobSchema` L13, `createJob` L77 | `mode` is preserve/creative; studio always sends `preserve` (I1) |
| Planning | worker | `lib/pipeline.ts` `planShots` L108 → `lib/prep.ts` `directShots` L196; `lib/studio-planner.ts` `planStudioPack` L13 | Two repair attempts, then a silent rule-based fallback (I11) |
| Admission / budget | per attempt | `lib/ai-spend.ts` `reserveSpend` → SQL `reserve_ai_spend`; `providers/openai.ts` L76 | Pooled-average policy is live |
| Render | per item | `lib/render-prompt.ts`: legacy, commission and studio branches | Additions dropped on two of three branches (I9) |
| Quality check | per item | `lib/generation-review.ts` `reviewPrompt` L43, `reviewChecks` L74; `packages/core` `quality.ts` `aggregate` | Judge receives the director's commission, not a customer goal (I1) |
| Settlement | per item | `lib/pipeline.ts` L343–366 → SQL `settle_item` | Any non-fail decision is captured (I6) |
| Retry / remake / edit | `/api/jobs/[id]/items/[itemId]/retry`, `/api/assets/[id]/remake`, `/edit` | `lib/jobs.ts` `retryItem` L229, `remakeAsset` L201, `editAsset` L282; `lib/generation-recovery.ts` | Retry keeps root budget lineage |
| Results / download | `/app/jobs/[id]`, `/api/assets/[id]/download`, `/api/assets/zip` | `components/job-view.tsx`; `lib/generation-failure.ts` | Per-reason failure copy is live (I18) |
| Worker | pg_cron → `POST /api/worker/tick` each minute | `lib/pipeline.ts` `runTick` L443; `lib/job-lease.ts` | |

## 4. Issue register

| ID | Sev | Evidence type | Finding | Evidence | Checklist |
|---|---|---|---|---|---|
| I1 | P0 | Observed + reproduced | No customer goal exists: the job schema has no outcome field, studio always submits `preserve`, and the judge checks against the director's own plan | BONKERS `bf60f737`: 6 slots, none worn (looks general-1, general-3, mens-modern-5, general-5, studio-texture, general-2). Tests: `mode: "preserve"`, Variety has no `human:"model"` | B01–B07, D02, D05, E09 |
| I2 | P0 | Reproduced | Flat or folded stitched garments can never become worn: `requiresWorn` demands `referenceForm==='worn'` (product-looks.ts L2411). 22 looks across 7 apparel collections are affected | core test "stitched, flat menswear is refused every model-worn look" | C09, C10, K01–K08 |
| I3 | P0 | Reproduced | Variety fills fixed roles from collection, general and studio pools, so a customer asking for a model shoot gets mixed still lifes | core test "BONKERS-like source: six slots, none worn" | D01, D05, D10 |
| I4 | P0 | Observed | Source clutter is treated as merchandise. BONKERS slot 04 (outdoor) failed for "added or omitted a product component" after the green garment and tissue from the source were absent; slot 03's brief placed the tee "beside part of the green garment" | DB items of `bf60f737`; audit spend and QA records | C01, C14, E10, B08 |
| I5 | P0 | Reproduced | 68 of 126 looks state a written condition but have none of the four structured gate flags. `fragrance-3` ("open atomizer reference") is eligible with a single front photo | core tests | C08, C11, I01 |
| I6 | P0 | **Observed** (the audit listed it as static only) | Outputs with a `review` verdict are delivered **and charged**. All-time: 18 delivered items with decision `review`; 16 have a credit capture, 3 of those later refunded | e.g. `ab03cd23` slot 5 (studio-detail, review, captured); `pipeline.ts` L343–366; web test | F01, F02, B09 |
| I7 | P0 | Observed (via Codex notes; saved images not re-inspected by Claude) | FEEO = Makeup Locking Spray (75ml). Job `a3f595f2` delivered a wrong nozzle (flatter cylinder, silver collar) with a `review` verdict. `ab03cd23` and `1fe675ee` produced a duplicated can and a detached cap. Codex notes a partial fix in `c25eb0a` | `docs/nozzle-budget-recovery.md`; DB items | E04, E10, C11 |
| I8 | P1 | Observed; cause not verified | The same makeup spray's photo set `1fe675ee` was planned with **skincare** looks (skincare-1, skincare-2, skincare-5). Current `inferCollection` would return makeup, so the stored profile at the time probably differed | DB items | C01, C07, K11, K12 |
| I9 | P1 | Reproduced | Selected additions reach only the legacy renderer. The commission branch (every new campaign shot) and the studio branch drop them. `selectedShotContract` is not imported anywhere live | web tests | E01, E02, B07 |
| I10 | P1 | Reproduced | The human-action check is word matching: "handbag" satisfies a required hand | web test | E08 |
| I11 | P1 | Reproduced (static) | The director's framing and human presence are overwritten by the assignment. After two invalid plans the job silently uses rule-based generic directions | web tests on `prep.ts` | D01, D05, E08 |
| I12 | P1 | Reproduced (static) | The analysis cache is reused when a photo is replaced or relabelled (same count and version); there is no checksum or view-role revision | web test | C02, C05 |
| I13 | P1 | Observed | Generic "In hand" is applied to any object. The Hyundai SUV photo set `2f2c3d0a` slot 1 was planned as "hands grip roof rail and close front door" and failed its check | DB item; core test (general Variety includes general-3) | C07, K25 |
| I14 | P1 | Observed; cause is a hypothesis | Since the 3 Nov deploy: 25 jobs, 60 items, 35 delivered, 23 quality fails. Reasons: 8 camera view not produced, 6 photographic direction missed, 5 setting/action/framing missed, 4 component, plus 1 budget and 1 reference needed. Failing check rows: creative_quality 31, studio_view 9, vlm_judge 9, style_adherence 5, product_inventory 4. Either plans ask for things the model can't execute, or checks are miscalibrated; only human-labelled review can tell | DB aggregate | D01, E12, I04 |
| I15 | P1 | Static | Provider pinned to one model (`gpt-image-2.5-sunburst`), at most 2 references, at most 1.1 MP, medium quality. Outputs are enlarged afterwards (816×1024 delivered as 1632×2048) | `providers/openai.ts` L76; BONKERS records | E15, I07 |
| I16 | P2 | Observed; **instrumentation fault introduced by Claude on 1 Nov** | `event_loop_blocked` logs read about 59 s on each minute-cron worker tick and about 119 s on each 2-minute keep-warm check. That matches the idle gap between invocations, so the monitor measures runtime suspension, not CPU blocking | Vercel runtime logs 14:26–14:31 UTC today | F11 |
| I17 | P2 | Reproduced | Core typecheck fails on one test file | `tsc` output | I12 |
| I18 | n/a | Resolved since my 1 Nov change | Budget failures had hidden Retry behind generic text. Production now maps each code to its own title, message and retry (`generation-failure.ts`) | code | E14, G17 (UI to verify in Phase 2) |
| I19 | P1 | Observed (2 Nov), outside pack scope | No custom email sender: Supabase's default email delivers sign-in only to team members. Sign-up sends a link, not a code. Blocks real customer sign-ups regardless of engine quality | auth.users, project env | A08, I10 |

The remaining failure classes the pack asks for, with status:
- **Wrong goal:** I1, I3.
- **Repeated pack views:** I14. Needs saved-image review; not yet reproduced offline.
- **Wrong component or nozzle:** I7.
- **Source clutter:** I4.
- **Stale evidence mapping:** I12.
- **Divergent prompt paths:** I9.
- **Pooled-spend early stops:** 1 budget stop since the deploy, versus 36 on 1–2 Nov under the old per-slot cap. The pooled policy has visibly reduced these, but this is a small sample. Correctness tests are Phase 5.
- **Misleading retry or charge states:** I6, I18.

## 5. Ordered implementation scope

1. **Phase 1, contracts (B01–B10):** versioned, additive `ProductEvidence`, `ShootGoal`, `ShotPlan`, `ReviewVerdict`, quote and settlement types in `packages/core`, with fixtures for BONKERS, FEEO, pens, caps, can, saree/unstitched, electronics, SUV and long names. No database migration is needed to define them. The migration plan comes with Phase 5.
2. **Phase 2, mobile prototype (G01–G23):** fixture adapter only, no generation changes. Can run alongside Phase 3 once Phase 1 is frozen. The brief's "no UI redesign before core quality" is respected because the prototype ships nothing and changes no engine behaviour.
3. **Phase 3, evidence and categories:** I2, I4, I5, I8, I12, I13 and the 200-cell matrix.
4. **Phase 4, director, compiler and QA:** I1, I3, I9, I10, I11, I14, I7 verification.
5. **Phase 5, settlement, cost and reliability:** I6 first, then pooled-budget verification and I16. Needs staging.
6. Phases 6–8 as in the pack.

**Rollback constraints:**
- Production `c25eb0a` must keep working against any schema added later, so every migration must be additive.
- In-flight and historical jobs keep their `prompt_version` semantics: no retroactive refunds or regeneration.
- The pooled policy keeps the old SQL function for rollback.
- Releases must build the exact tested commit with the production target. Never alias a preview.

## 6. Limits of this phase

- Saved output images were not visually re-inspected. The visual findings in I4 and I7 come from stored records and Codex notes.
- Characterization tests prove code behaviour, not output quality.
- Vercel Hobby keeps logs for 1 hour.
- Historical failure counts mix code versions and internal tests; they are not customer rates.

## 7. Decisions needed before the dependent phases

1. **Integrator.** Codex has pushed to `redesign-v3` (PRs #25–#28). One tool must own shared contracts, migrations and release. Proposed: Claude owns this branch; Codex does not push to `redesign-v3` without merging through it.
2. **Staging for Gate 2 / Phase 5.** A second Supabase project, or Supabase branching, plus a preview environment with its own keys. This costs money and needs your account action. Phases 1–4 do not need it.
3. **Owners.** Work packages are unassigned until you name owners.
