import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { C, s } from "@/lib/theme";

interface JobRow { id: string; status: string; style: string; count: number; createdAt: string; product: { name: string }; thumbs: string[] }

const TONE: Record<string, string> = { completed: C.good, review_needed: C.warn, failed: C.bad };

export default function Library() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setJobs((await api<{ jobs: JobRow[] }>("/api/jobs?limit=40")).jobs); } catch { /* keep old */ }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 20, gap: 14 }}
        ListHeaderComponent={<Text style={[s.display, { marginBottom: 6 }]}>Shoots</Text>}
        ListEmptyComponent={<Text style={s.small}>No shoots yet. Start one from Home.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/job/${item.id}`)} style={[s.card, { padding: 12, flexDirection: "row", gap: 12, alignItems: "center" }]}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", width: 72, height: 72, gap: 2 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Image key={i} source={item.thumbs[i] ? { uri: item.thumbs[i] } : undefined} style={{ width: 35, height: 35, borderRadius: 4, backgroundColor: C.paper2 }} />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "600", color: C.ink }}>{item.product?.name}</Text>
              <Text style={s.small}>{item.count} images · {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
            </View>
            <Text style={{ fontSize: 12, color: TONE[item.status] ?? C.mute }}>{item.status.replace("_", " ")}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
