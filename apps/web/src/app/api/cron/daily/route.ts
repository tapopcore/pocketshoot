import { json, publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runDailyChecks } from "@/lib/alerts";

export const maxDuration = 300;

export const POST = publicHandler(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return json({ error: "unauthorized" }, 401);
  return runDailyChecks();
});
