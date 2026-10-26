import { handler } from "@/lib/api";
import { cancelJob } from "@/lib/jobs";

export const POST = handler<{ id: string }>(async (_req, ctx, { id }) => cancelJob(ctx, id));
