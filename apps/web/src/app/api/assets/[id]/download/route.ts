import { handler } from "@/lib/api";
import { downloadAsset } from "@/lib/assets";

export const GET = handler<{ id: string }>(async (req, ctx, { id }) => {
  const u = new URL(req.url);
  const format = (["png", "jpg", "webp"].includes(u.searchParams.get("format") ?? "") ? u.searchParams.get("format") : "png") as "png" | "jpg" | "webp";
  const size = u.searchParams.get("size") === "web" ? "web" : "full";
  const file = await downloadAsset(ctx, id, format, size, u.searchParams.get("fit"));
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.type, "content-disposition": `attachment; filename="${file.name}"`, "cache-control": "private, no-store" },
  });
});
