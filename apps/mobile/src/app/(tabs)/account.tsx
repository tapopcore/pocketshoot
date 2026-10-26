import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/lib/session";
import { config } from "@/lib/config";
import { Button } from "@/components/ui";
import { C, s } from "@/lib/theme";

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Ionicons name={icon} size={20} color={C.ink2} />
      <Text style={{ flex: 1, fontSize: 16, color: C.ink }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={C.mute} />
    </Pressable>
  );
}

export default function Account() {
  const { me, signOut } = useSession();
  const open = (p: string) => Linking.openURL(`${config.apiUrl}${p}`);
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
        <Text style={s.display}>Account</Text>
        <Text style={s.body}>{me?.user?.email}</Text>
        <Text style={s.small}>Workspace: {me?.org.name} ({me?.org.role})</Text>
        <View style={{ marginTop: 16 }}>
          <Row icon="people-outline" label="Team, brand kits and batch (on the web)" onPress={() => open("/app/team")} />
          <Row icon="receipt-outline" label="Invoices" onPress={() => open("/app/wallet")} />
          <Row icon="help-buoy-outline" label="Help" onPress={() => open("/app/support")} />
          <Row icon="document-text-outline" label="Terms" onPress={() => open("/legal/terms")} />
          <Row icon="shield-checkmark-outline" label="Privacy" onPress={() => open("/legal/privacy")} />
          <Row icon="trash-outline" label="Delete my account" onPress={() => Alert.alert("Delete account", "Open Settings on the web to request deletion of your workspace and images.", [{ text: "Cancel", style: "cancel" }, { text: "Open", onPress: () => open("/app/settings") }])} />
        </View>
        <Button title="Sign out" variant="outline" onPress={signOut} style={{ marginTop: 24 }} />
        <Text style={[s.small, { textAlign: "center", marginTop: 12 }]}>Version {Constants.expoConfig?.version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
