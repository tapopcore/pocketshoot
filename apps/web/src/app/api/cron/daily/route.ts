import { json, publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runDailyChecks } from "@/lib/alerts";

// 299, not 300: heavy image work gets its own server function, apart from app pages and quick APIs.
export const maxDuration = 299;

export const POST = publicHandler(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return json({ error: "unauthorized" }, 401);
  return runDailyChecks();
});
