# Generation reliability incident — 31 October 2026

Root causes confirmed from stored attempts and quality checks across categories:

- The upload analyser and result checker independently counted products. A necklace plus earrings was counted as two units in one call and one retail set in another. The numeric mismatch rejected nine recent results whose comparative verdict otherwise passed.
- The checker sometimes assigned source hands/background context to the generated image. Images now have explicit adjacent ORIGINAL/RESULT labels.
- Crop rules and blanket inventory/marked-surface rules conflicted. The same selected crop contract now governs generation and review.
- Concurrent slots independently planned the entire pack and could overwrite the direction while another slot was generating. In-process singleflight plus a database compare-and-set protects stored plans across workers.
- An invalid coordinated plan silently fell back and caused a direction_unavailable failure. A single bounded text-only repair now precedes any image spend; invalid plans remain blocked.
- A partially failed pack was rolled up as completed. It now requires attention.
- Retrying always bought a new image. A saved rejected output is now rechecked first; a passing image is restored free, with a recovery lease so the queue cannot generate it concurrently.

Quality remains strict for actual missing parts, changed product design/text/colour, wrong environment, missed actions, invalid anatomy and unsupported views. Suspect rejections get one independent vision/text confirmation using existing pixels. There is no automatic paid image regeneration.

Verification: full core and web suites, TypeScript, changed-file lint, production build, and saved-image rechecks in the authenticated admin UI. Record live results separately; unit checks do not establish photographic output quality or an all-category success guarantee.
