# Pocket Shoot V2: implementation and acceptance notes

## Why these changes exist

The original application generated costly extra calls, defaulted to two images, silently reused original pixels when cleanup failed, and could mark geometrically aligned images as passing even if they were not commercially usable. This branch addresses those problems without overwriting production.

## What changed

### Product workflow

1. A new upload is analysed and optionally retouched once.
2. The studio shows the **actual** prepared product alongside its original.
3. A clear status says either **AI retouched**, **cutout only**, or **original unchanged**. Background removal is not described as removing dust.
4. User must inspect and explicitly approve the preview. Approval persists in `product_assets.metadata.prepApprovedAt` through POST `/api/products/[id]/approve-preparation`.
5. `createJob` checks for approval before reserving credits. Internal admin preview jobs retain a separate privileged path.
6. One selected scene and one billable image is the default. More outputs require deliberate selection.

### Generation and costs

- OpenAI image models are constrained to the GPT Image 2.5 Sunburst/Flare family by conservative application guardrails. Admin may still choose among those explicitly. Review official model eligibility and pricing before expanding.
- Low-complexity studio outputs request medium quality; challenging scenes retain high quality.
- One SDK request attempt, no hidden automatic retry. The application uses at most two image attempts per slot.
- Worker concurrency cap two.
- The AI request budget preflight in `apps/web/src/lib/ai-budget.ts` defaults to **USD 5 in recorded/estimated daily cost** or 70 tracked calls, whichever comes first. This is intentionally conservative and **not** a bank-grade atomic budget guarantee. Set `AI_DAILY_BUDGET_USD` / `AI_DAILY_MAX_CALLS` separately in server environment; never prefix with NEXT_PUBLIC_.
- Analysis, shot direction and vision judging write `ai_operation` analytics events with model, usage, result and request ID when available. Image attempts use `generation_attempts`. Preparation also has `ai_cost` events.
- Some costs are unpriced until invoice reconciliation. Do not advertise precise profit margins based on image attempts alone.
- Model preparation errors will not automatically trigger more attempts on every shoot.

### Image quality

- Image prompts now have scene-specific practical lighting, real-world scale and material requirements, controlled temporary defect cleanup, label fidelity and meaningful prop placement.
- Every non-mock image receives an independent assessment of commercial usability, realistic light, shadow and cleanup as well as identity.
- Model judges are advisory. Their scores do not replace human approval or genuine defect refunds.
- Avoid claims such as "all labels stay exact" or "every photo is automatically fixed".

### Observability and security

- API logs serialize structured Supabase error messages instead of `[object Object]`.
- Rate limiting fails closed if the database cannot verify allowances.
- The GitHub repository was public when audited. Change visibility using GitHub's Settings, after reviewing Vercel access.
- Supabase advisor flagged `is_org_member` as a callable SECURITY DEFINER function. Audit its existing permissions and security logic before changing it; other RLS-enabled server-only tables intentionally lack browser policies.
- Environment secrets must stay server-only and in Vercel, not in source code or reports.

## CI and verification

- CI uses pinned actions, `npm ci`, core Vitest tests and a full Next.js build.
- No AI calls are made by CI.
- A Vercel READY deployment establishes build success only.
- The production branch is unchanged until owner approval and a reviewed merge.

## What is NOT yet proven

- Quality of 30+ representative real product images against a human evaluation rubric
- OpenAI invoice reconciliation against all internal attempts, vision checks and preparation calls
- Reliable end-to-end preview login/generation with a dedicated staging Supabase database and storage
- Full responsive screen-by-screen device review and accessibility QA
- Complete accounting for concurrent AI operations at larger scale (needs atomic budget reservations)
- Full security penetration and database authorization review

## Safe staging test instructions

1. Create a separate Supabase staging project/branch, acknowledging any compute cost, and apply the existing migrations there.
2. Point Vercel **Preview** environment to staging credentials, not production Supabase.
3. Use a minimal, explicitly capped OpenAI API budget in Preview only; never paste API keys into chat.
4. Test at least these cases: clean printed cosmetics box, dusty bottle, glossy jar, sachet with lots of text, metallic jewellery, plus a bad/blurred photo.
5. For each: upload, inspect prepared state, approve, generate one, compare label/cap/colour at 100%, request refund on a genuine defect, verify one credit captured or released.
6. Verify no automatic extra retouch after an initial failed preparation and no provider work after the spending cap is reached.
7. Reconcile OpenAI usage export with server `generation_attempts` and `analytics_events` before accepting margins.
8. Owner approves UI and image results before merging this PR.

## Release gate

Do not merge until CI and a real staging-image quality benchmark pass. This implementation deliberately favours honest visible limitations over fabricated "perfect product photo" guarantees.
