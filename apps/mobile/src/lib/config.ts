import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

/** Values come from app.json "extra" (or app.config.js in CI). */
export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "").replace(/\/$/, ""),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || "",
  revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || extra.revenuecatIosKey || "",
  revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || extra.revenuecatAndroidKey || "",
};
