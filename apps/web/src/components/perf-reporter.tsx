"use client";
import { useEffect } from "react";

/**
 * Reports how long screens and photos really take on the user's phone (page data requests and
 * photo downloads), so slow spots can be found from the logs. Sends small batches, never blocks.
 */
export function PerfReporter() {
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    const batch: Record<string, unknown>[] = [];
    const flush = () => {
      if (!batch.length) return;
      const body = JSON.stringify(batch.splice(0, 40));
      try { navigator.sendBeacon?.("/api/perf", body) || fetch("/api/perf", { method: "POST", body, keepalive: true }); } catch { /* ignore */ }
    };
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        const u = e.name;
        const kind = u.includes("_rsc=") ? "page" : u.includes("/media/") ? "photo" : u.includes("/api/") ? "api" : null;
        if (!kind || u.includes("/api/perf")) continue;
        batch.push({ k: kind, p: new URL(u).pathname.slice(0, 60), ms: Math.round(e.duration), ttfb: Math.round(e.responseStart - e.startTime), kb: Math.round((e.transferSize || 0) / 1024) });
      }
      if (batch.length >= 20) flush();
    });
    try { obs.observe({ type: "resource", buffered: true }); } catch { return; }
    const t = setInterval(flush, 15000);
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", hide);
    return () => { obs.disconnect(); clearInterval(t); document.removeEventListener("visibilitychange", hide); flush(); };
  }, []);
  return null;
}
