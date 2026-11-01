export const dynamic = "force-dynamic";

/** The version this server runs. Open tabs compare it with their own to pick up new releases. */
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID || "dev" }, { headers: { "cache-control": "no-store" } });
}
