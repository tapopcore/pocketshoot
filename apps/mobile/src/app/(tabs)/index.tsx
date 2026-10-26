import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useDraft } from "@/lib/draft";
import { Notice, Stat } from "@/components/ui";
import { C, s } from "@/lib/theme";

interface Product { id: string; name: string; category: string; coverUrl: string | null; photoCount: number }

export default function Home() {
  const { me, refresh, error } = useSession();
  const { reset, set } = useDraft();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    await refresh();
    try { setProducts((await api<{ products: Product[] }>("/api/products?limit=20")).products); } catch { /* shown via error */ }
    setLoading(false);
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startNew = () => { reset(); router.push("/shoot"); };
  const reuse = (p: Product) => {
    reset();
    set({ productId: p.id, productName: p.name, category: p.category, photos: p.coverUrl ? [p.coverUrl] : [] });
    router.push("/shoot/look");
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <FlatList
        data={products.filter((p) => p.photoCount > 0)}
        keyExtractor={(p) => p.id}
        numColumns={3}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 14, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20, gap: 18, paddingTop: 12 }}>
            <Text style={s.eyebrow}>{me?.org.name ?? " "}</Text>
            <Text style={[s.display, { fontSize: 42, lineHeight: 44 }]}>What are we{"\n"}shooting <Text style={{ color: C.accent, fontStyle: "italic" }}>today?</Text></Text>
            {error && <Notice tone="bad">{error}</Notice>}
            <Pressable onPress={startNew} style={({ pressed }) => ({ backgroundColor: C.ink, borderRadius: 20, padding: 22, opacity: pressed ? 0.9 : 1 })}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 20, fontWeight: "600" }}>New photoshoot</Text>
                  <Text style={{ color: "#ffffffaa", marginTop: 4 }}>Photograph your product now, or pick from your gallery.</Text>
                </View>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="camera" size={26} color="#fff" />
                </View>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Stat label="Credits" value={me?.wallet.available ?? "–"} />
              <Stat label="Used" value={me?.wallet.consumed ?? "–"} />
            </View>
            {products.length > 0 && <Text style={[s.h2, { marginTop: 8 }]}>Shoot again</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => reuse(item)} style={{ flex: 1 / 3 }}>
            <Image source={item.coverUrl ? { uri: item.coverUrl } : undefined} style={{ aspectRatio: 1, borderRadius: 10, backgroundColor: C.paper2 }} contentFit="cover" />
            <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 13, color: C.ink }}>{item.name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<View style={{ paddingHorizontal: 20 }}><Text style={s.small}>Your products will appear here after your first shoot.</Text></View>}
      />
    </SafeAreaView>
  );
}
