"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export interface Me {
  org: { id: string; name: string };
  wallet: { available: number; reserved: number };
  policy: { maxImagesPerJob: number; freeRemakes: number; trialCredits: number };
  features: { creativeMode: boolean };
}

/** Waits for App Bridge, then loads the shop's workspace and wallet. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 40 && !window.shopify?.idToken; i++) await new Promise((r) => setTimeout(r, 100));
      if (!window.shopify?.idToken) { setError("Open this app from your Shopify admin."); return; }
      try { const m = await api<Me>("/api/me"); if (!cancelled) setMe(m); } catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [tick]);
  return { me, error, reload: () => setTick((t) => t + 1) };
}
