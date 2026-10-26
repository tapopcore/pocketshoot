import "server-only";

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "PocketShoot",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseServiceKey: opt("SUPABASE_SERVICE_ROLE_KEY") || "",
  geminiKey: opt("GEMINI_API_KEY"),
  openaiKey: opt("OPENAI_API_KEY"),
  falKey: opt("FAL_KEY"),
  razorpayKeyId: opt("RAZORPAY_KEY_ID"),
  razorpayKeySecret: opt("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: opt("RAZORPAY_WEBHOOK_SECRET"),
  shopifyApiKey: opt("SHOPIFY_API_KEY"),
  shopifyApiSecret: opt("SHOPIFY_API_SECRET"),
  shopifyApiVersion: opt("SHOPIFY_API_VERSION") || "2026-07",
  revenuecatWebhookAuth: opt("REVENUECAT_WEBHOOK_AUTH"),
  cronSecret: opt("CRON_SECRET"),
  encryptionKey: opt("ENCRYPTION_KEY"),
  resendKey: opt("RESEND_API_KEY"),
  emailFrom: opt("EMAIL_FROM") || "PocketShoot <hello@example.com>",
  alertEmail: opt("ALERT_EMAIL"),
  platformAdminEmails: (opt("PLATFORM_ADMIN_EMAILS") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  /** Sandbox payments only when Razorpay keys are missing and this is explicitly on. */
  allowSandboxPayments: opt("ALLOW_SANDBOX_PAYMENTS") === "true",
  isProd: process.env.VERCEL_ENV === "production",
};

export const integrations = {
  get gemini() { return !!env.geminiKey; },
  get openai() { return !!env.openaiKey; },
  get fal() { return !!env.falKey; },
  get razorpay() { return !!(env.razorpayKeyId && env.razorpayKeySecret); },
  get shopify() { return !!(env.shopifyApiKey && env.shopifyApiSecret); },
  get revenuecat() { return !!env.revenuecatWebhookAuth; },
  get email() { return !!env.resendKey; },
};

export function integrationStatus() {
  return [
    { name: "Supabase", ok: !!(env.supabaseUrl && env.supabaseServiceKey), need: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY" },
    { name: "Google Gemini (images + accuracy checks)", ok: integrations.gemini, need: "GEMINI_API_KEY" },
    { name: "OpenAI GPT Image", ok: integrations.openai, need: "OPENAI_API_KEY" },
    { name: "fal.ai (FLUX + background removal)", ok: integrations.fal, need: "FAL_KEY" },
    { name: "Razorpay", ok: integrations.razorpay && !!env.razorpayWebhookSecret, need: "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET" },
    { name: "Shopify app", ok: integrations.shopify && !!env.encryptionKey, need: "SHOPIFY_API_KEY, SHOPIFY_API_SECRET, ENCRYPTION_KEY" },
    { name: "RevenueCat (mobile purchases)", ok: integrations.revenuecat, need: "REVENUECAT_WEBHOOK_AUTH" },
    { name: "Email (Resend)", ok: integrations.email, need: "RESEND_API_KEY, EMAIL_FROM" },
    { name: "Queue + cron secret", ok: !!env.cronSecret, need: "CRON_SECRET" },
  ];
}
