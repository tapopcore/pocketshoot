import { handler } from "@/lib/api";
import { pushToShopify } from "@/lib/assets";

export const POST = handler<{ id: string }>(async (_req, ctx, { id }) => pushToShopify(ctx, id));
