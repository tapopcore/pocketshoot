/**
 * Retired: concept previews must never schedule image generation.
 * Keep an explicit response for old browser tabs that still POST this route.
 */
function disabled() {
  return Response.json({ state: "disabled", urls: [] }, {
    status: 410,
    headers: { "Cache-Control": "no-store" },
  });
}
export const GET = disabled;
export const POST = disabled;
