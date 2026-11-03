export const maxDuration = 60;

/** Receives real tap-to-screen timings from the app so slow spots show up in the logs. */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    if (body.length < 8000) console.log(JSON.stringify({ ev: "client_perf", data: JSON.parse(body) }));
  } catch { /* ignore bad payloads */ }
  return new Response(null, { status: 204 });
}
