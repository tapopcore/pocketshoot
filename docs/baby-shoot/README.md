# Baby Shoot (vertical inside PocketShoot)

Branch `claude/baby-vertical`, based on the live production commit `c25eb0a`.

## What it is

A section of the signed-in app at `/app/baby` for newborn photo shoots (birth to about 10 weeks), using PocketShoot's own sign-in and PocketShoot's own OpenAI key.

- Upload one or two photos of the baby (asleep, awake).
- Make one photo in a chosen theme, or a shoot of 6, 10 or 15 with themes mixed across styles.
- Open a result, compare it with the original, save it in HD (as made) or 4K (enlarged to 3840 px), or share it through the phone's share menu.

29 newborn themes in 7 families live in `apps/web/src/lib/baby/themes.ts`. Each is a written description of a studio set. None copies a specific photograph, and none uses characters, brands or lettering. Every prompt keeps the hips covered.

## Who can use it

Platform accounts only for now. Everyone else gets 404 on the page and on `/api/baby/generate`, and does not see the menu link. The reason: it does not charge credits yet, so it must not be open to customers.

## What it does not do yet

- It does not charge credits.
- It does not save photos. Reference photos are held in memory for one request and the result goes straight back to the browser.
- It does not write to PocketShoot's cost ledger, because that ledger is tied to products and jobs. Until that is wired, the OpenAI dashboard is the spend record.

## Changes to existing files

One: `components/nav-links.tsx` gains a "Baby Shoot" link in the Platform group and a breadcrumb label. Everything else is new files.

## Checks run

`docs/baby-shoot/checks/e2e.js` against a production build, through `/dev/baby` (the example-data preview, on only with `PREVIEW_UI=1` and no OpenAI key, where the route can only return labelled sandbox images): 37 of 37 pass at 360, 390 and 1280 px. `eslint` and `tsc` are clean. In a normal build `/dev/baby` and the old `/baby` return 404 and a signed-out request to `/api/baby/generate` returns 401.

Not yet done: a real generation. No paid request has been made. The signed-in page itself has not been exercised locally, because the local build has no database connection.
