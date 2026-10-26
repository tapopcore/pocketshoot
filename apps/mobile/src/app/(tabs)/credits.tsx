import { useCallback, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PurchasesStoreProduct } from "react-native-purchases";
import { config } from "@/lib/config";
import { useSession } from "@/lib/session";
import { buy, purchasesAvailable, storeProducts } from "@/lib/purchases";
import { Notice, Stat } from "@/components/ui";
import { C, s } from "@/lib/theme";

interface Pack { id: string; name: string; credits: number; store_product_id: string | null; badge: string | null }

export default function Credits() {
  const { me, refresh } = useSession();
  const [packs, setPacks] = useState<{ pack: Pack; product?: PurchasesStoreProduct }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const channel = Platform.OS === "ios" ? "ios" : "android";
      const r = await fetch(`${config.apiUrl}/api/packs?channel=${channel}`).then((x) => x.json()) as { packs: Pack[] };
      const ids = r.packs.map((p) => p.store_product_id).filter(Boolean) as string[];
      const products = await storeProducts(ids).catch(() => []);
      setPacks(r.packs.map((p) => ({ pack: p, product: products.find((x) => x.identifier === p.store_product_id) })));
    } catch { /* offline */ }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); refresh(); }, [load, refresh]));

  async function purchase(p: { pack: Pack; product?: PurchasesStoreProduct }) {
    if (!p.product) return;
    setBusy(p.pack.id);
    try {
      await buy(p.product);
      // The server adds credits when the store confirms; give it a moment.
      for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 1500)); await refresh(); }
      Alert.alert("Thank you", `${p.pack.credits} credits are being added to your account.`);
    } catch (e) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) Alert.alert("Purchase didn't go through", err.message ?? "You weren't charged.");
    }
    setBusy(null);
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={s.display}>Credits</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label="Available" value={me?.wallet.available ?? "–"} />
          <Stat label="In progress" value={me?.wallet.reserved ?? "–"} />
        </View>
        <Text style={s.body}>One credit makes one delivered image. Failed images cost nothing. Credits bought on the website work here too.</Text>
        {loading ? <ActivityIndicator color={C.accent} /> : !purchasesAvailable() ? (
          <Notice>In-app purchases aren&apos;t set up in this build. You can buy credits on the website.</Notice>
        ) : packs.map((p) => (
          <Pressable key={p.pack.id} disabled={!p.product || !!busy} onPress={() => purchase(p)} style={[s.card, { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: p.product ? 1 : 0.5 }, p.pack.badge ? { borderColor: C.ink, borderWidth: 1 } : null]}>
            <View>
              <Text style={s.eyebrow}>{p.pack.name}{p.pack.badge ? ` · ${p.pack.badge}` : ""}</Text>
              <Text style={[s.display, { fontSize: 30, marginTop: 4 }]}>{p.pack.credits} <Text style={s.small}>credits</Text></Text>
            </View>
            {busy === p.pack.id ? <ActivityIndicator color={C.accent} /> : (
              <View style={{ backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "600" }}>{p.product?.priceString ?? "Unavailable"}</Text>
              </View>
            )}
          </Pressable>
        ))}
        <Pressable onPress={() => Linking.openURL(`${config.apiUrl}/pricing`)}><Text style={[s.small, { textAlign: "center", textDecorationLine: "underline" }]}>See website prices</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
