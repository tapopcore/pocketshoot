import "server-only";

/** Times a server step and logs it when slow, so real-world delays show up in the logs. */
export async function timed<T>(label: string, work: () => Promise<T>, slowMs = 400): Promise<T> {
  const t = Date.now();
  try { return await work(); }
  finally {
    const ms = Date.now() - t;
    if (ms > slowMs) console.warn(JSON.stringify({ ev: "slow_step", step: label, ms }));
  }
}
