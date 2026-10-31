# Product-led photography rebuild — 31 October 2026

Release base: redesign-v3, a5b2a68. Existing uncommitted snapshot was left untouched.

## Direction

We considered a dense studio-control interface and an editorial, photography-led flow. The latter better serves first-time Indian sellers: category-specific examples, one supported photograph to start, explicit price, progressively revealed options. Existing brand orange and typography remain recognisable.

The Indian-market research informs photographic principles, product construction, context and campaign coverage. No third-party campaign photograph is shipped, copied into a prompt reference, scraped into training data or used to fine-tune a model. The generation model and configured quality remain unchanged.

## Product and engine

- Preserve the analysed first-photo unit count and worn/loose/packaged source form.
- Retain concise use and visual strategy in upload analysis. No upload-time image preview call.
- Plan ordered non-studio looks together in one direction request, with category-specific disciplines and distinct commercial roles. Do not clone missing directions.
- New shoots edit original references directly. Remove preparatory paid cutouts and pasted composites from the new-generation path. Existing image edits retain their edit-mask workflow.
- Apply recipe-aware style checks to retries as well as original requests. Check print on the same physical visible surface rather than projecting front text onto a blank reverse.
- Reject confirmed identity, count, setting, requested action, anatomical, realism and studio-view failures. An unavailable accuracy check fails closed.
- Do not silently regenerate a rejected image. Do not retry ambiguous timeouts/5xx automatically; explicit rate-limit refusals can back off. Disable SDK image retries, request one output and retain provider request IDs. Unknown timeout costs remain null, not asserted zero.
- Stop before an image call if a non-studio creative plan is unavailable.
- Six-view studio packs require supporting angle references; a single front view supports a front and visible-detail direction, not fabricated unseen geometry.

## Visuals and mobile

- 126 category looks and 10 Studio views have individual locally sized lazy-loaded photographic assets.
- 37 older lighting setups now have full photographic references instead of coloured backgrounds with a pasted cutout.
- New original campaigns: footwear, skincare, earrings, sarees, prepared Indian food and general products. Other usable category examples are retained.
- Examples are illustrative, use shared demo products and disclose synthetic adults. They do not promise the exact output of the application engine.
- Rebuilt the storefront and category browser around photography and commercial use.
- Mobile shoot-kind controls are compact, with actual style photos immediately below them. Full labels, squared cards, smaller job headers, original-photo viewer and safe-area spacing remain supported.
- Start at one photo and one credit unit; six-photo packs are explicit choices. Navigation exposes the framework's pending state immediately. Existing request-scoped auth and wallet caching are retained.

## Release checks

Core and web regression suites cover inventory, source form, category compatibility, complete visual assets, credit reservation/capture, wrong environments, wrong studio views, rejected outputs, provider retries and request IDs. Type checks and lint run on changed code. The native Windows Next compiler cannot canonicalise the checkout in this environment; the production-environment Vercel build is the required compilation gate before promotion.

Production Supabase and OpenAI keys exist only in the production environment. Never alias a preview deployment to the live domain. Keep the previous verified deployment available for rollback. No secrets are copied into source or artifacts.

A passing vision screen is a screening signal, not proof of perfect fidelity or world-class photographic taste. Real output comparisons and mobile browser verification are required in addition to code tests. Existing historic customer images are not replaced by illustrative demos.
