# Phase 2: mobile prototype on fixtures

Branch `claude/phase2-prototype`, based on `claude/phase1-contracts` (549d09a). Every screen reads from one fixture adapter shaped by the Phase 1 contracts. Nothing calls the database, storage, payments or an image model. The live `/app` is untouched.

## 1. What now works and why it matters to the customer

The whole primary journey can be walked on a phone with example data:

Home → Take photo / Upload photo / saved product → "Is this right?" product check → choose Studio photos, Model & everyday use or Creative campaign → look, number of photos, photo shape → "Ready to create" with the plan, size and exact credits → progress and results → viewer with compare and zoom → scoped variations, retry and keep/remove for held photos.

What a customer gets from it:

- **Goal before style.** The kind of shoot is chosen first. Looks, quantity and shape follow, and nothing is made until the review step.
- **No silent padding.** With one front photo, Studio supports 4 different photos. Asking for 6 shows "Your photo supports 4 different studio photos, not 6" with the way to unlock more. The review charges 4, not 6.
- **No guessing.** A look that needs a view the customer hasn't supplied (for example "On skin" needs a photo of the lotion) is never shown as available. Tapping it opens Take photo / Upload photo. After adding the photo, the same look stays selected and every other choice is kept.
- **Honest outcomes per photo.** Each result is marked Ready, Check before use (credit held until the customer keeps or removes it), or Not delivered, which shows the specific reason, says the credit was returned, and offers a retry only when a retry can help. The copy comes straight from the contract's `presentFailure`.
- **Accurate size.** "2048 px delivered (made at 1024 px and enlarged)", per the honest-resolution rule. No watermark.
- **Account clarity.** You shows name, email, workspace, balance, credit history (each line adds up to the balance), the real launch packs from `lib/public.ts`, help, privacy and sign out.

Two visual directions, both using the existing brand tokens, fonts and orange: **Studio** (dark Create card, plain headings, numbered plan) and **Editorial** (light Create card, a Bodoni italic word in each heading, serif plan numbers). A toggle in the prototype banner switches between them.

**Recommendation: Studio.** On the task screens it puts more contrast on the main action and keeps headings plain, so choices read faster. Editorial matches the public website's italic accent more closely. If brand continuity matters more, one Editorial touch (the italic word on Home only) can be carried over without changing the flow. This is your call at review; everything else is identical between them.

## 2. Files and checklist IDs

New files only. No existing file was edited.

| Path | Purpose |
|---|---|
| `apps/web/src/app/prototype/layout.tsx` | Gate: `notFound()` unless `PREVIEW_UI=1`, the same rule as `/dev`. noindex. |
| `apps/web/src/app/prototype/page.tsx` | Home (returning and first run) |
| `apps/web/src/app/prototype/create/{page,create-flow}.tsx` | Add product, Is this right?, Choose shoot, Ready to create |
| `apps/web/src/app/prototype/shoots/page.tsx`, `shoots/[id]/{page,result-view}.tsx` | Shoots list, results, viewer, variation and retry sheets |
| `apps/web/src/app/prototype/products/page.tsx`, `you/page.tsx`, `states/page.tsx` | Products, You, index of every screen and state |
| `apps/web/src/components/prototype/{shell,ui}.tsx` | Navigation shell, toast, accessible Sheet and Viewer, true-ratio shape icon |
| `apps/web/src/lib/prototype/demo.ts` | The mock adapter (fixtures typed by `@packshot/core/contracts`) |
| `apps/web/src/styles/prototype.css` | Scoped `.pt` tokens and components for both directions |
| `docs/handover/phase-2-screens/*.webp` | Screenshots |
| `docs/handover/phase-2-checks/{e2e,timing,shoot}.js` | The Playwright checks used below (run against `PREVIEW_UI=1 next start -p 3123`) |

Checklist status:

| ID | Status | Note |
|---|---|---|
| G01 | Done | Two directions, Studio recommended. Your choice decides. |
| G02 | Done | Full journey on fixtures |
| G03 | Done | Semantic tokens in `prototype.css`; one component set for both directions |
| G04 | Done | Home, Shoots, Create, Products, You; identity, balance, history and sign out on You |
| G05 | Done | Create in the tab bar and sidebar; hidden inside the create flow so it never covers the action bar |
| G06 | Done | Take photo and Upload photo at capture, in every "one more photo" sheet, and in Replace photo |
| G07 | Done | Source photo, short summary, what stays the same, product type, one clutter question, what the photos can't show |
| G08 | Done | Three offerings with static examples labelled "Example" |
| G09 | Done | 3–4 looks per offering |
| G10 | Done | Compact two-column look cards with a single selection outline |
| G11 | Done | Studio looks use one consistent demo bottle; the customer's raw photo is only ever shown as "Your photo" |
| G12 | Partly | Every stand-in image is labelled Example. Rights/provenance of the `/public/showcase` images is not documented in the repo; needs your confirmation. |
| G13 | Done | Plan list, missing-photo notes, count, size and exact credits before Create |
| G14 | Done | Every photo opens; Escape or Close; zoom; compare with your photo; focus returns |
| G15 | Done | Compact header and progress; photos follow directly |
| G16 | Done | Keep lighting, Another pose, Clearer product, Change setting, Replace photo, each stating "1 photo · 1 credit" and that the original stays |
| G17 | Done | Reason, credit state and the right recovery action on each tile |
| G18 | Done (mock) | Draft kept in session storage across reload and back; camera blocked; signed-out state keeps the setup |
| G19 | Done (mock) | Loading, empty, upload error, analysing, partial, offline, camera blocked, not enough credits, prices changed, signed out |
| G20 | Done | True-ratio shape icons; no clipped text or horizontal scroll at 320–1280 px; sticky bar does not cover content |
| G21 | Done | Motion is feedback only; reduced motion turns off shimmer and transitions; layout shift 0.001–0.006 |
| G22 | Done | Keyboard, focus trap and return, named controls, 320 px and 200% zoom. Screen-reader pass with a real reader not done. |
| G23 | Done | Measurements below |

## 3. What was actually tested

Environment: production build (`next build` + `next start`) in the cloud workspace, Chromium via Playwright, `PREVIEW_UI=1`. This is not a physical phone.

- `eslint` (0 errors), `tsc --noEmit` pass. Unit tests unchanged and passing: web 159, core 154.
- `e2e.js`: **33 of 33 checks pass.** Upload, analyse, choose, needs-photo sheet (focus in, Escape, focus back, choice kept), quantity, review total, draft survives reload, results reflect the chosen shoot, viewer and compare, keep a held photo, no page errors, every Tab stop has a name, no horizontal scroll at 320 px and 640 px (200% zoom of 1280) on five screens, reduced motion, direction toggle.
- Screenshots at 360, 390, 430, 768 and 1280 px with an overflow check on every page: none.
- Timings with the CPU slowed 4×:
  - **Tab navigation:** 48–200 ms. The first visit to each tab is the slowest.
  - **Tap to painted selection:** 17–45 ms.
  - **Slow network** (150 ms latency, 1.6 Mbps): first heading at about 0.3 s, LCP 0.26–0.32 s, layout shift 0.006.
- Gate check: in a normal build without `PREVIEW_UI`, `/prototype`, `/prototype/create`, `/prototype/states`, `/prototype/shoots/demo-job` and `/prototype/you` all return 404. The first-load JS of `/app`, `/app/new` and `/app/jobs/[id]` is the same as the baseline: 112, 153 and 151 kB.

Issues found and fixed during testing:

- Base resets were overriding button padding.
- The look grid was stretching.
- The results tile overflowed when a photo was not delivered.
- The shortcut scroller ignored the page padding.
- A blocked look was announced as disabled even though tapping it opens the photo request.
- A Studio plan slot asked for a back label and a turned angle that a single front photo cannot support. It now follows `VIEW_NEEDS_SOURCE`.
- Results showed 6 photos regardless of what was chosen.
- The banner wrapping and the late-loading font caused a 0.158 layout shift. It is now 0.006.

## 4. Screenshots

`docs/handover/phase-2-screens/`:

- **Main journey at 390 px:** home, home-empty, capture, understand, shoot, review-smaller, review-insufficient, result, you, states.
- **Narrowest phone (360 px):** shoot, result.
- **Tablet and desktop:** home-768, shoot-1280, result-1280.
- **Editorial direction:** ed-home, ed-shoot.

To walk every state yourself, open `/prototype/states` in a `PREVIEW_UI=1` build.

## 5. Gaps and risks

- **Mocked, not connected:**
  - Upload, analysis, the plan, generation, review and settlement are fixtures with timers.
  - Buying credits shows "not connected".
  - Sign out does nothing.
- **Example images:**
  - Result tiles reuse the lotion images for every offering, so Studio results do not look like true white-background shots.
  - The Studio look examples use a different demo product (the FIELD bottle) than the lotion in the flow.
  - Both images are labelled Example. Proper same-product examples for all three offerings need new demo images, which means paid generation or a photoshoot. Not done.
- **Category coverage:** only one product (skincare). The 25-collection applicability matrix is Phase 3.
- **Live-app finding, not fixed:** the live app has the same late-font reflow, and `brand.css` has no width-matched fallback. A one-line `@font-face` fallback like the one in `prototype.css` would fix it. It would change the live site, so I left it for your decision.
- **Not done:**
  - A real screen reader (VoiceOver/TalkBack) and a physical device test.
  - The 200% text-only zoom setting. Page zoom was tested instead.

## 6. Production

Unchanged. No deploy, environment variable, alias, migration or data change. Production stays on dpl_3LCAE24VHwVfWZ2o6aYEsgkMzpas (c25eb0a). The branch push triggers a preview build, which is cancelled. The prototype is off in every environment, because `PREVIEW_UI` is not set anywhere on Vercel.

## 7. Provider spend

None. No image generation and no AI review. The allowance is untouched.

## 8. Next dependent phase

1. **Your product review of the prototype.** Pick a direction and mark anything to change. To review on your phone, the option is to set `PREVIEW_UI=1` on Vercel for this preview branch only (Preview target, branch-scoped, never Production). Not done without your go-ahead.
2. **Phase 3:** evidence and category coverage, the 25 × 8 matrix, and live fixes for I2, I4, I5, I8, I12 and I13 as additive changes. This does not depend on the direction choice.
