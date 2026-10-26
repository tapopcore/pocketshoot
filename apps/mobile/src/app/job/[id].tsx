import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { DONE, jobCache, type JobData } from "@/lib/job";
import { useSession } from "@/lib/session";
import { Notice } from "@/components/ui";
import { C, s } from "@/lib/theme";

const LABEL: Record<string, string> = { queued: "Waiting", preparing: "Preparing", generating: "Creating", checking: "Checking accuracy" };

function Pulse() {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(v, { toValue: 0.4, duration: 800, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ position: "absolute", inset: 0, backgroundColor: C.paper2, opacity: v }} />;
}

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useSession();
  const [data, setData] = useState<JobData | null>(jobCache.get(id) ?? null);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<JobData>(`/api/jobs/${id}`);
      jobCache.set(id, d);
      setData(d);
      setError(null);
      if (!DONE.includes(d.job.status)) timer.current = setTimeout(load, 2500);
      else refresh();
    } catch (e) {
      setError((e as Error).message);
      timer.current = setTimeout(load, 6000);
    }
  }, [id, refresh]);

  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [load]);

  if (!data) return <View style={[s.screen, { alignItems: "center", justifyContent: "center" }]}>{error ? <Text style={s.body}>{error}</Text> : <ActivityIndicator color={C.accent} />}</View>;

  const byItem = new Map(data.assets.map((a) => [a.item_id, a]));
  const ready = data.items.filter((i) => i.status === "delivered").length;
  const active = data.items.some((i) => !["delivered", "failed", "cancelled"].includes(i.status));
  const col = (width - 20 * 2 - 10) / 2;
  const ratio = data.assets[0] ? data.assets[0].width / data.assets[0].height : 1;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: data.job.products.name }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {active && <ActivityIndicator size="small" color={C.accent} />}
        <Text style={[s.body, { fontWeight: "600", color: C.ink }]}>{data.job.statusLabel}</Text>
        <Text style={s.small}>{ready} of {data.job.requested_count} ready</Text>
      </View>
      {active && <Notice>Usually 20 to 60 seconds per image. You can close this screen; we&apos;ll keep working.</Notice>}
      {data.job.is_trial && ready > 0 && <Notice tone="warn">Trial images have a watermark. Buy credits for full-size clean images.</Notice>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {data.items.map((it) => {
          const a = it.delivered_asset_id ? byItem.get(it.delivered_asset_id) : undefined;
          return (
            <Pressable key={it.id} disabled={!a} onPress={() => a && router.push({ pathname: "/asset/[id]", params: { id: a.id, job: id } })}
              style={{ width: col, aspectRatio: ratio, borderRadius: 10, overflow: "hidden", backgroundColor: C.paper2 }}>
              {a?.thumbUrl ? (
                <>
                  <Image source={{ uri: a.thumbUrl }} style={{ flex: 1 }} contentFit="cover" transition={600} />
                  {a.quality_status === "review" && <View style={{ position: "absolute", top: 6, right: 6, backgroundColor: "#FFF3D6", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ fontSize: 11, color: C.warn }}>Check closely</Text></View>}
                  {a.approval_status === "approved" && <View style={{ position: "absolute", bottom: 6, right: 6 }}><Ionicons name="checkmark-circle" size={22} color={C.good} /></View>}
                </>
              ) : it.status === "failed" ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 10 }}>
                  <Ionicons name="alert-circle-outline" size={22} color={C.bad} />
                  <Text style={[s.small, { textAlign: "center", marginTop: 4 }]}>{it.last_error ?? "Failed. Credit returned."}</Text>
                </View>
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Pulse />
                  <Text style={s.eyebrow}>{LABEL[it.status] ?? it.status}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
