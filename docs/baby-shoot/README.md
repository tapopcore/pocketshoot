# Baby Shoot test lab (vertical inside PocketShoot)

Branch `claude/baby-vertical`, based on the live production commit `c25eb0a`. New files only; no existing file is edited.

## What it is

A private page at `/baby` for testing newborn photo generation with the same OpenAI image model PocketShoot uses.

- Upload one or two photos of the baby (asleep, awake).
- Make one photo in a chosen theme, or a shoot of 6, 10 or 15 with themes mixed across styles.
- Open a result, compare it with the original, save it in HD (as made) or 4K (enlarged to 3840 px), or share it through the phone's share menu.

29 newborn themes in 7 families live in `apps/web/src/lib/baby/themes.ts`. Each is a written description of a studio set. None copies a specific photograph, and none uses characters, brands or lettering. Every prompt keeps the hips covered.

## Safety switches

- The lab exists only where the environment variable `BABY_LAB_CODE` is set. Without it, `/baby`, `/api/baby/check` and `/api/baby/generate` all answer 404. Production has no such variable.
- Every request must carry that code. A wrong or missing code gets 401.
- Nothing is written to the database or storage. Reference photos are held in memory for one request and the result goes straight back to the browser.
- With no `OPENAI_API_KEY`, the lab runs in a labelled sandbox mode and spends nothing.
- One photo per request, fixed size (about 1.3 MP), standard quality unless "Best quality" is ticked.

Lab spend is not recorded in PocketShoot's cost ledger, because that ledger is tied to products and jobs. The OpenAI dashboard is the record. Set a spend limit there before testing.

## To turn it on for the branch preview

In Vercel, for the Preview environment and branch `claude/baby-vertical` only, add:

1. `OPENAI_API_KEY`: an OpenAI key, ideally a new one made for this test.
2. `BABY_LAB_CODE`: any passphrase of your choice.

Then redeploy the branch. Remove both when testing ends.

## Checks run

`docs/baby-shoot/checks/e2e.js` against a production build in sandbox mode: 39 of 39 pass at 360, 390 and 1280 px (gate, wrong code, upload, one photo, shoot of 6, no sideways scroll, viewer focus and Escape, compare, 4K export size, no page errors). `eslint` and `tsc` are clean. With the code unset, all three lab URLs return 404.

Not yet done: a real generation. No paid request has been made.
