-- Default settings and launch price hypotheses. All editable in admin without a deploy.

insert into public.app_settings(key, value) values
  ('credit_policy', '{"creditsPerImage":1,"freeRemakes":1,"remakeWindowDays":7,"trialCredits":2,"trialWatermark":true,"paidExpiryMonths":12,"promoExpiryDays":60,"maxImagesPerJob":8}'),
  ('providers', '{"generation":"auto","fallback":"mock","gemini":{"model":"gemini-2.5-flash-image","judgeModel":"gemini-2.5-flash"},"openai":{"model":"gpt-image-2","quality":"high"},"fal":{"model":"fal-ai/flux-pro/kontext","segmentModel":"fal-ai/birefnet"},"costUsdPerImage":{"gemini":0.039,"openai":0.17,"fal":0.04,"mock":0},"concurrency":4,"timeoutMs":120000}'),
  ('quality', '{"alignmentReview":0.82,"alignmentFail":0.6,"colourDeltaReview":8,"colourDeltaFail":18,"useJudge":true}'),
  ('seller', '{"legalName":"","tradeName":"PocketShoot","gstin":"","stateCode":"07","address":"","email":"","phone":"","sacCode":"998399","gstRatePercent":18,"invoicePrefix":"PS","exportUnderLut":false,"note":"Confirm legal entity, GSTIN and SAC code with your accountant before going live."}'),
  ('shopify_billing', '{"test":true}'),
  ('fx_fallback', '{"USDINR":88.0}'),
  ('retention', '{"originalsDays":365,"outputsDays":365,"failedDays":30}')
on conflict (key) do nothing;

insert into public.pricing_packs(code, name, credits, price_minor, currency, channel, badge, sort) values
  ('starter', 'Starter', 5, 49900, 'INR', 'web', null, 1),
  ('creator', 'Creator', 15, 119900, 'INR', 'web', null, 2),
  ('brand', 'Brand', 40, 279900, 'INR', 'web', 'Most picked', 3),
  ('business', 'Business', 100, 599900, 'INR', 'web', null, 4),
  ('agency', 'Agency', 250, 1249900, 'INR', 'web', 'Lowest per image', 5),
  -- Shopify charges merchants in USD through Shopify Billing.
  ('starter', 'Starter', 5, 699, 'USD', 'shopify', null, 1),
  ('creator', 'Creator', 15, 1699, 'USD', 'shopify', null, 2),
  ('brand', 'Brand', 40, 3999, 'USD', 'shopify', 'Most picked', 3),
  ('business', 'Business', 100, 8499, 'USD', 'shopify', null, 4),
  ('agency', 'Agency', 250, 17999, 'USD', 'shopify', 'Lowest per image', 5);

-- Store packs: prices are set in App Store Connect / Play Console; these rows map product ids to credits.
insert into public.pricing_packs(code, name, credits, price_minor, currency, channel, store_product_id, sort) values
  ('starter', 'Starter', 5, 59900, 'INR', 'ios', 'pocketshoot.credits.5', 1),
  ('creator', 'Creator', 15, 139900, 'INR', 'ios', 'pocketshoot.credits.15', 2),
  ('brand', 'Brand', 40, 329900, 'INR', 'ios', 'pocketshoot.credits.40', 3),
  ('starter', 'Starter', 5, 59900, 'INR', 'android', 'pocketshoot_credits_5', 1),
  ('creator', 'Creator', 15, 139900, 'INR', 'android', 'pocketshoot_credits_15', 2),
  ('brand', 'Brand', 40, 329900, 'INR', 'android', 'pocketshoot_credits_40', 3);

insert into public.feature_flags(key, scope, value) values
  ('creative_mode', 'global', 'true'),
  ('batch_jobs', 'global', 'true'),
  ('shopify_push', 'global', 'true'),
  ('hindi_ui', 'global', 'true'),
  ('signups_open', 'global', 'true');
