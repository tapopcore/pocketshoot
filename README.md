# PackShot

AI product photography for real products. One engine, three ways in:

| Surface | Where | Code |
|---|---|---|
| Web app + marketing site + admin | `https://your-domain.com` | `apps/web` (Next.js 15) |
| Shopify embedded app | Shopify admin → Apps | `apps/web/src/app/shopify` + `shopify.app.toml` |
| iOS and Android app | App Store / Google Play | `apps/mobile` (Expo SDK 58) |
| Shared rules (presets, prompts, credit maths, GST) | | `packages/core` |
| Database, ledger, queue | Supabase Postgres | `supabase/migrations` |

## How an image gets made

1. Upload goes straight to private storage through a signed URL. The server decodes it, fixes orientation, strips EXIF/GPS and re-encodes it. Anything that isn't a real image is rejected.
2. **Preserve mode (default):** the product is cut out (fal.ai BiRefNet if configured, otherwise a local background remover), placed on a canvas at the output size, and sent to the image model with a mask. The model paints the scene. The original product pixels are then composited back on top, so labels and logos come from the customer's photo. If the model moved the product, we don't composite (it would double the product) and the image is flagged for review.
3. **Creative mode:** reference photos go to the model and it may redraw the product. A Gemini vision check compares result and reference.
4. Checks: alignment, colour drift, blank output, dimensions, AI judge. `pass` / `review` are delivered; `fail` is retried, then released with no charge.
5. Credits: reserved at submit, captured per delivered image, released on failure. A validated report restores the credit. All in an append-only ledger (`credit_ledger`) with SQL functions so it is atomic and idempotent.

Providers sit behind one adapter (`apps/web/src/lib/providers`). Default order is Gemini → OpenAI → fal. Model IDs, order and per-image cost are editable in **Admin → Settings → providers** without a deploy. With no keys at all, a clearly labelled sandbox makes placeholder images so the whole flow can be tested.

## Setup

```bash
npm install                 # web + core (workspaces)
cd apps/mobile && npm install
cp .env.example apps/web/.env.local   # fill in
```

### 1. Supabase
- Create a project (Mumbai `ap-south-1` recommended).
- Apply `supabase/migrations/*.sql` in order (or `supabase db push`).
- Auth → Providers: Email on (OTP). Optional Google: add OAuth client ID/secret.
- Auth → URL configuration: Site URL = your domain; add `https://your-domain.com/auth/callback`.
- Auth → Email template "Magic link": include `{{ .Token }}` so the mobile app can use the 6-digit code.
- After deploying the web app, run `supabase/cron.template.sql` with your URL and `CRON_SECRET` (queue worker every minute + daily checks).

### 2. Web app (Vercel)
- Import the repo, root directory `apps/web`. Add the variables from `.env.example`.
- Functions: the worker route uses up to 300 s (`maxDuration`), which needs Vercel Fluid compute (default on new projects).
- First admin: put your email in `PLATFORM_ADMIN_EMAILS`, sign in, open `/admin`.
- **Before real payments:** Admin → Settings → `seller`: legal name, GSTIN, address, state code, SAC code (confirm with your CA), invoice prefix.

### 3. Razorpay
- Keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- Webhook → `https://your-domain.com/api/webhooks/razorpay`, events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `payment.dispute.lost`. Secret → `RAZORPAY_WEBHOOK_SECRET`.

### 4. Shopify app
- Create an app in the Shopify Partner dashboard. Put its client ID in `shopify.app.toml`, replace `REPLACE_WITH_DOMAIN`, then `shopify app deploy` (sets scopes, URLs and webhooks including the three privacy webhooks).
- Env: `SHOPIFY_API_KEY`, `NEXT_PUBLIC_SHOPIFY_API_KEY` (same value), `SHOPIFY_API_SECRET`, `ENCRYPTION_KEY`.
- Billing uses Shopify one-time charges. `shopify_billing.test` is `true` by default; set `false` in Admin → Settings at launch.

### 5. Mobile app
- Fill `apps/mobile/app.json` → `extra` (API URL, Supabase URL/anon key, RevenueCat keys) and the iOS `bundleIdentifier` / Android `package`.
- RevenueCat: create the consumable products (`packshot.credits.5` etc. for iOS, `packshot_credits_5` etc. for Android, matching Admin → Pricing), add a webhook to `https://your-domain.com/api/webhooks/revenuecat` with an Authorization header value of `Bearer <REVENUECAT_WEBHOOK_AUTH>`.
- Build: `npx eas-cli@latest build --platform all`, submit with `eas submit`. In-app purchases need a development or production build (not Expo Go).

## Tests

```bash
npm test                    # 19 core tests + 18 web tests (ledger SQL in PGlite, image pipeline)
cd apps/web && npx next build
cd apps/mobile && npx tsc --noEmit
```

## Decisions made (from the open questions in the spec)

| Question | Decision | Change it in |
|---|---|---|
| Charging rule | Reserve on submit, charge only delivered images, 1 free remake per image within 7 days | Admin → Settings → `credit_policy` |
| Trial | 2 credits per verified email, max 3 per network per 30 days, watermark, 1024px | `credit_policy` |
| Credit expiry | Paid 12 months, free/bonus 60 days | `credit_policy` |
| Output resolution | 2048px long edge (website hero 2560px) | `packages/core/src/presets.ts` |
| Retention | Failed outputs deleted after 30 days | `retention` |
| Payment gateway | Razorpay (web), Shopify Billing (Shopify), Apple/Google via RevenueCat (mobile) | |
| Pricing | Spec's launch hypotheses (web INR, Shopify USD) | Admin → Pricing |

## Known limitations

- Automatic checks are screening signals, not guarantees. Human QA (Admin → Quality) before launch.
- No antivirus scan of uploads; files are fully decoded and re-encoded, which removes non-image payloads.
- HEIC uploads are rejected on web (the mobile app converts to JPEG first).
- Legal pages are plain-language drafts; have a lawyer review (DPDP, consumer rules, GST).
- Apple and Google in-app pricing is set in their consoles; the app shows the store price.
