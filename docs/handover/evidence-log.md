# Evidence log

A checkbox in `01-TASK-CHECKLIST.md` changes only when a row here records the evidence for it. Status values: Not started / In progress / Blocked / Done. Owner is "unassigned" until the founder names one.

| Task | Owner | Status | Commit/files | Test or evidence | Limits | Next dependency |
|---|---|---|---|---|---|---|
| A01 | Claude | Done | `docs/handover/phase-0-baseline.md` | PDF (23 pp), brief, audit and pack 00–05 read; manifest hashes verified | n/a | n/a |
| A02 | Claude | Done | same | Vercel: prod alias → `dpl_3LCAE24…` at `c25eb0a`; tree equals `redesign-v3` | Rechecked 5 Nov 20:00 IST only | Recheck before any release |
| A03 | Claude | Done | branch `claude/phase0-baseline` (worktree) | No uncommitted work; earlier commits are ancestors of prod | n/a | Integrator decision |
| A04 | Claude | Done | same | Only `apps/mobile/AGENTS.md` (Expo, mobile scope); no conflicts | Skill `design-world-class-uiux` unavailable | Phase 2 states substitute |
| A05 | Claude | Done | report §3 | File/line map of each step | Static read | Phase 1 |
| A06 | Claude | In progress | report §2 | Production build route sizes: shared JS 103 kB; `/app` 112 kB, `/app/new` 153 kB, `/app/jobs/[id]` 151 kB, `/app/products/[id]` 144 kB first load. Field timings from 1 Nov client reports: most app pages 0.1–0.4 s | Screenshots and API-contract snapshots of the current app not yet captured on this branch | Phase 2 start |
| A07 | Claude | Done (constraint) | n/a | Public website out of scope; no site files touched | n/a | n/a |
| A08 | Claude | In progress | n/a | Nothing removed; auth/uploads/library/storage/credits untouched | Ongoing obligation | every phase |
| A09 | Claude | In progress | DB IDs in report §4 | BONKERS `bf60f737`, FEEO `ab03cd23`/`1fe675ee`/`a3f595f2`, SUV `2f2c3d0a` located and read | Immutable fixture files not created yet | Phase 1 (B10) |
| A10 | Claude | Done | two `handover-characterization.test.ts` files | 109 + 147 existing pass; 7 + 11 characterization reproduce defects; web tsc pass; core tsc 1 test-file error; lint 0 errors; build ok | Offline only | Invert per fix |
| A11 | unassigned | Blocked | n/a | No staging database exists; preview has no service key, so it cannot touch production data either | Needs founder account action | Gate 2 / Phase 5 |
| A12 | Claude | Done | n/a | SELECT-only queries; no deploy, env, balance or paid call | n/a | n/a |

## Phase 1 (branch `claude/phase1-contracts`)

| Task | Owner | Status | Commit/files | Test or evidence | Limits | Next dependency |
|---|---|---|---|---|---|---|
| B01 | Claude | Done (contract) | `contracts/shoot-goal.ts` `OFFERING_DEFINITIONS` | Offering/family mismatch test | Copy and UI in Phase 2 | Phase 2 |
| B02 | Claude | Done (contract) | `shoot-goal.ts` | Goal, direction, quantity, aspect, additions are separate fields | Not wired live | Phase 4 |
| B03 | Claude | Done | `contracts/*.ts` | 38 contract tests | Not wired live | Phases 3–5 |
| B04 | Claude | Done (contract) | `quote.ts` | Expiry, goal, evidence, plan, credit tests | Live quote route unchanged | Phase 5 |
| B05 | Claude | Done (contract) | `goalFeasibility`, `TransformationPermission` | Unsupported vs needs_reference vs needs_confirmation tests | Category rules are Phase 3 | Phase 3 |
| B06 | Claude | In progress | `confirmGoal`, `goalIntact` | Frozen, fingerprinted, tamper test | Persistence is Phase 5 migration | Phase 5 |
| B07 | Claude | Not started | n/a | n/a | Needs all entry points | Phases 4–5 |
| B08 | Claude | Done (contract) | `ENTITY_ROLES`, `keepInPhotos` | BONKERS clutter and tag tests; FEEO background bottle test | Classification quality is Phase 3 | Phase 3 |
| B09 | Claude | Done (contract) | `settlement.ts` | Review holds, never captures; transition tests | Live `settle_item` unchanged | Phase 5 |
| B10 | Claude | Done | `dto.ts`, `fixtures.ts` | Summary-derivation and subpath import tests | Fixture images not yet drawn | Phase 2 |
| A09 | Claude | Done | `fixtures.ts` | BONKERS, FEEO, pens, caps, beverage, unstitched, SUV, long name | Evidence only, no output images | n/a |
| C05 | Claude | In progress | `evidenceIsCurrent`, `sourceFingerprint` | Replaced/relabelled photo invalidates cache (test) | Live cache in `prep.ts` unchanged (I12) | Phase 3 |
| A11 | Claude | Blocked (approval) | `phase-1-contracts.md` staging section | Options A/B/C costed | Needs founder approval to create staging project | Gate 2 |
| G01 | Claude | Done (awaiting your pick) | `styles/prototype.css` `data-direction` | Studio and Editorial screenshots in `phase-2-screens/` | Studio recommended | Founder review |
| G02 | Claude | Done (mock) | `app/prototype/**`, `lib/prototype/demo.ts` | `phase-2-checks/e2e.js`: 33 of 33 pass | Fixtures only | Phases 3–5 wire real data |
| G03–G11, G13–G17, G20–G21, G23 | Claude | Done (mock) | `app/prototype/**`, `components/prototype/**` | e2e, 5-width screenshots, timing.js (tap 17–45 ms, tab nav 48–200 ms at 4× CPU, CLS 0.006) | Example images reuse one product | Phase 3 |
| G12 | Claude | Partly | Example labels on every stand-in image | Visual check | Rights of `/public/showcase` images undocumented | Founder confirms provenance |
| G18–G19 | Claude | Done (mock) | `create-flow.tsx`, `/prototype/states` | Reload keeps draft; all states listed and reachable | Session storage only | Phase 5 persistence |
| G22 | Claude | Partly | `components/prototype/ui.tsx` | Focus trap and return, named Tab stops, 320 px and 640 px no scroll | No real screen reader or device yet | Device review |
| Gate | Claude | Verified | `app/prototype/layout.tsx` | Normal build: all `/prototype` routes 404; `/app` first-load JS unchanged (112/153/151 kB) | n/a | n/a |
