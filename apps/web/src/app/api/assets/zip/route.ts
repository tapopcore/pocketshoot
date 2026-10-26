import { z } from "zod";
import { body, handler } from "@/lib/api";
import { exportZip } from "@/lib/assets";

export const maxDuration = 120;

export const POST = handler(async (req, ctx) => {
  const { ids, format } = await body(req, z.object({ ids: z.array(z.string().uuid()).min(1).max(100), format: z.enum(["png", "jpg", "webp"]).default("jpg") }));
  const zip = await exportZip(ctx, ids, format);
  return new Response(new Uint8Array(zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="photos-${new Date().toISOString().slice(0, 10)}.zip"`, "cache-control": "no-store" },
  });
});
