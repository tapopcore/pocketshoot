import { publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { paymentMode } from "@/lib/billing";
import { babyBusiness } from "@/lib/baby/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public settings the Baby Shoot app needs before sign-in. Only values that are safe in a browser. */
export const GET = publicHandler(async () => ({
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
  payments: paymentMode(),
  business: await babyBusiness(),
}));
