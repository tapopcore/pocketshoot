"use client";
import { useEffect } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
const STALE = /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Failed to find Server Action|unexpected response was received from the server|Importing a module script failed/i;

/**
 * Keeps an open tab working after we ship a new version.
 * Without this, a tab opened before a release can no longer load the new code for the next
 * screen, so buttons silently do nothing until the page is refreshed. When that happens, or
 * when the server reports a newer version, the next tap loads the page fresh instead.
 */
export function DeployGuard() {
  useEffect(() => {
    let stale = false;
    const reload = () => {
      try {
        const last = Number(sessionStorage.getItem("ps-reload") || 0);
        if (Date.now() - last < 20_000) return; // never loop
        sessionStorage.setItem("ps-reload", String(Date.now()));
      } catch { /* storage blocked: reload anyway */ }
      window.location.reload();
    };
    const onError = (msg: unknown) => { if (STALE.test(String(msg ?? ""))) reload(); };
    const err = (e: ErrorEvent) => onError(e.message || e.error?.message || e.error?.name);
    const rej = (e: PromiseRejectionEvent) => onError((e.reason as Error)?.message ?? (e.reason as Error)?.name ?? e.reason);
    const check = async () => {
      if (BUILD === "dev" || document.hidden) return;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { build } = await r.json();
        if (build && build !== BUILD) stale = true;
      } catch { /* offline: try later */ }
    };
    // A tap on any in-app link after a release does a full load, so the new code is used.
    const click = (e: MouseEvent) => {
      if (!stale || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
      e.preventDefault();
      window.location.assign(a.href);
    };
    const visible = () => { if (!document.hidden) void check(); };
    addEventListener("error", err);
    addEventListener("unhandledrejection", rej);
    document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visible);
    const t = setInterval(check, 5 * 60_000);
    void check();
    return () => { removeEventListener("error", err); removeEventListener("unhandledrejection", rej); document.removeEventListener("click", click, true); document.removeEventListener("visibilitychange", visible); clearInterval(t); };
  }, []);
  return null;
}
