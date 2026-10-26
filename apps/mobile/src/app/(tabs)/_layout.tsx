import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/lib/theme";

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={String(color ?? C.ink2)} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.accent,
      tabBarInactiveTintColor: C.ink2,
      tabBarStyle: { backgroundColor: C.paper, borderTopColor: C.line },
      sceneStyle: { backgroundColor: C.paper },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="library" options={{ title: "Shoots", tabBarIcon: icon("images-outline") }} />
      <Tabs.Screen name="credits" options={{ title: "Credits", tabBarIcon: icon("wallet-outline") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("person-outline") }} />
    </Tabs>
  );
}
