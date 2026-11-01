import { randomUUID } from "node:crypto";
import { json, publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runTick } from "@/lib/pipeline";

// 299, not 300: heavy image work gets its own server function, apart from app pages and quick APIs.
export const maxDuration = 299;

/** Queue worker. Called by pg_cron every minute and right after a job is submitted. */
export const POST = publicHandler(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return json({ error: "unauthorized" }, 401);
  return runTick(`w-${randomUUID().slice(0, 8)}`, 280_000);
});
