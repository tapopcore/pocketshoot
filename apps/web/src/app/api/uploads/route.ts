import { body, handler } from "@/lib/api";
import { createUploadUrls, uploadRequestSchema } from "@/lib/products";
import { track } from "@/lib/observe";

/** Returns signed URLs so the client uploads straight to private storage. */
export const POST = handler(async (req, ctx) => {
  const { files } = await body(req, uploadRequestSchema);
  await track("upload_started", ctx, { files: files.length });
  return { uploads: await createUploadUrls(ctx, files) };
});
