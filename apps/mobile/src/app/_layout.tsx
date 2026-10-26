import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SessionProvider, useSession } from "@/lib/session";
import { DraftProvider } from "@/lib/draft";
import { C } from "@/lib/theme";
import { initPurchases } from "@/lib/purchases";

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, ready, me } = useSession();
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  useEffect(() => { if (me) initPurchases(me.org.id).catch(() => {}); }, [me?.org.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: C.paper }, headerTintColor: C.ink, contentStyle: { backgroundColor: C.paper }, headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="shoot/index" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="shoot/details" options={{ title: "About the product" }} />
        <Stack.Screen name="shoot/look" options={{ title: "Pick the look" }} />
        <Stack.Screen name="job/[id]" options={{ title: "Your shoot" }} />
        <Stack.Screen name="asset/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <DraftProvider>
        <StatusBar style="dark" />
        <RootStack />
      </DraftProvider>
    </SessionProvider>
  );
}
