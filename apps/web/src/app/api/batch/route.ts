import { z } from "zod";
import { OUTPUTS, STYLES } from "@packshot/core";
import { ApiError, body, handler } from "@/lib/api";
import { assertRole } from "@/lib/auth";
import { createJob } from "@/lib/jobs";
import { getFlag } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { getWallet } from "@/lib/credits";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  productIds: z.array(z.string().uuid()).min(1).max(200),
  mode: z.enum(["preserve", "creative"]).default("preserve"),
  style: z.string().refine((s) => s in STYLES),
  output: z.string().refine((s) => s in OUTPUTS),
  countPerProduct: z.number().int().min(1).max(4),
  brandKitId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
  batchKey: z.string().min(8).max(80),
});

/** Same style for many products at once. Each product becomes its own job. */
export const POST = handler(async (req, ctx) => {
  assertRole(ctx, "editor");
  if (!(await getFlag("batch_jobs", ctx.orgId))) throw new ApiError(400, "Batch jobs are not enabled");
  const input = await body(req, schema);
  const needed = input.productIds.length * input.countPerProduct;
  const wallet = await getWallet(ctx.orgId);
  if (wallet.available < needed) throw new ApiError(402, `This batch needs ${needed} credits and you have ${wallet.available}.`, "insufficient_credits");
  const db = admin();
  const { data: batch, error } = await db.from("batches").insert({ organization_id: ctx.orgId, project_id: input.projectId ?? null, name: input.name, source: ctx.via, created_by: ctx.userId }).select("id").single();
  if (error) throw error;
  const results: { productId: string; jobId?: string; error?: string }[] = [];
  for (const productId of input.productIds) {
    try {
      const r = await createJob(ctx, {
        productId, projectId: input.projectId ?? null, batchId: batch.id, mode: input.mode, style: input.style, output: input.output,
        count: input.countPerProduct, brandKitId: input.brandKitId ?? null, idempotencyKey: `${input.batchKey}:${productId}`,
      });
      results.push({ productId, jobId: r.jobId });
    } catch (e) {
      results.push({ productId, error: (e as Error).message });
    }
  }
  return { batchId: batch.id, results };
});
