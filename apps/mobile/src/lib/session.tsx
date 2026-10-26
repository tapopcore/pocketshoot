import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { api } from "./api";

export interface Catalog {
  categories: { id: string; label: string; labelHi: string; short: string; difficulty: string; caution?: string; defaultLocks: string[]; recommendedPresets: string[] }[];
  styles: { id: string; name: string; nameHi: string; description: string; swatch: [string, string] }[];
  outputs: { id: string; name: string; ratio: string; width: number; height: number; hint: string }[];
}

export interface Me {
  user: { id: string; email: string; locale: "en" | "hi" } | null;
  org: { id: string; name: string; role: string };
  orgs: { id: string; name: string; role: string }[];
  wallet: { available: number; reserved: number; consumed: number };
  policy: { maxImagesPerJob: number; freeRemakes: number; trialCredits: number };
  features: { creativeMode: boolean };
  catalog: Catalog;
}

interface Ctx {
  session: Session | null;
  ready: boolean;
  me: Me | null;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Ctx>({ session: null, ready: false, me: null, error: null, refresh: async () => {}, signOut: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) refresh();
    else setMe(null);
  }, [session, refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setMe(null);
  }, []);

  return <SessionContext.Provider value={{ session, ready, me, error, refresh, signOut }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
