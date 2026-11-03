/**
 * Runs once when a server instance starts. Logs cold starts and any moment the server is
 * blocked (event loop stalled), so slow taps can be traced in the Vercel logs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __psLag?: boolean };
  if (g.__psLag) return;
  g.__psLag = true;
  console.log(JSON.stringify({ ev: "instance_start", uptime: Math.round(process.uptime() * 1000) }));
  let last = Date.now();
  const t = setInterval(() => {
    const now = Date.now(), lag = now - last - 1000;
    if (lag > 400) console.warn(JSON.stringify({ ev: "event_loop_blocked", ms: lag }));
    last = now;
  }, 1000);
  t.unref?.();
}
