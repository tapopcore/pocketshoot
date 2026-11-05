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
