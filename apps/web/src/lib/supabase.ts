import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "./env";

let adminClient: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS: every query must filter by an authorised org. */
export function admin(): SupabaseClient {
  if (!adminClient) {
    if (!env.supabaseUrl || !env.supabaseServiceKey) throw new Error("Supabase is not configured");
    adminClient = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** Cookie-based client for the signed-in web user. */
export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component; middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Unwraps a Supabase response or throws a readable error. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what = "query"): T {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what} returned nothing`);
  return res.data;
}
