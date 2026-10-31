# Cost, variety and reference controls — 31 October 2026

Production incident audit found high-quality 1536px rendering, all references sent to every image, coarse image-input pricing, untracked text/vision stages and paid retry chains. A recent successful six-pack recorded INR44.338 for images alone (INR7.39 delivered); the mouse pack recorded INR77.002 (INR12.83 delivered). These historical figures are application estimates, not reconciled invoices.

## Current policy

- Native image generation uses gpt-image-2.5-sunburst, medium, approximately 1024px long edge (minimum-area rules can increase the long edge). Exports may be upscaled; native size and quality are stored on the item.
- Each shot uses a primary inventory reference plus at most one relevant angle/detail. All uploaded photos remain available to product analysis.
- Image text input is priced at USD5/M and image input USD8/M when the provider reports the split; output USD30/M. Missing usage stays unknown. Text/vision calls record reported tokens, model, stage, FX and cost.
- Before every paid call, an atomic reservation checks an INR5 admission budget. Shared planning/analysis costs are allocated across the original shoot. Child retries inherit the original photo budget, including historical image attempts. Reservations survive unknown/time-out charges. No automatic paid quality regeneration.
- Request forecasts are conservative operating estimates, not a provider-enforced billing cap. Any measured overrun or unknown image charge stops further image admissions for investigation. The API has no INR cap parameter; failed attempts mean an absolute INR5 per delivered image cannot be guaranteed. Provider taxes, FX fees, storage and payment costs are outside token-priced AI estimates.
- Older text/vision usage was not fully recorded and cannot be reconstructed exactly. The admin report now identifies this coverage limit and pending/unknown calls.

## Originality and usability

- Every new job receives a persistent, fresh creative territory across composition, lighting and product story. A richer history includes 36 previous scene/camera/light combinations. The director is instructed to change at least three meaningful axes while respecting the customer's theme, environment, action and product truth.
- Presets supply purpose/constraints and inspiration, rather than repeating mandatory background recipes. Selected themes such as Diwali remain in the assignment. One coordinated text plan covers a set; static studio compositions need no director call. No paid per-upload image previews.
- A single front reference supports six honest white-studio compositions: front, rim light, directional shadow, editorial spacing, visible detail and material crop. Genuine side/back requests require those specifically labelled references. No promise of six unseen angles from one front image.
- Camera and upload are both available when adding references in Create and the product library. Existing photos can be relabelled Front, Angled, Side, Back, Close-up or Other and opened/closed full screen. Label changes invalidate cached analysis.

## Verification and diagnostics

Type checking, web/core regressions, real PostgreSQL migration/ledger tests and targeted lint precede release. The backend-only internalQa flag is absent from the public job schema. Explicit internal jobs with no customer actor can record ten-minute signed original/result links in the server-only analytics table for authorised visual verification. No bucket is made public and no desktop session is required.

The INR5 policy protects further spending; it does not turn a rejected output into a successful deliverable or guarantee subjective photographic excellence. Strict identity, anatomy, environment and realism checks remain active.
