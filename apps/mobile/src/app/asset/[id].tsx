import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Asset as LibraryAsset, requestPermissionsAsync } from "expo-media-library";
import { api, newKey } from "@/lib/api";
import { jobCache } from "@/lib/job";
import { Button } from "@/components/ui";
import { C, s } from "@/lib/theme";

const REASONS: [string, string][] = [
  ["logo_changed", "The logo changed"], ["text_changed", "Label text changed"], ["wrong_product", "It's a different product"],
  ["missing_product", "Product is missing"], ["extra_items", "Extra or duplicate items"], ["colour_wrong", "Colour is wrong"], ["shape_wrong", "Shape is wrong"], ["other", "Something else"],
];

async function downloadToCache(url: string, name: string) {
  const dir = new Directory(Paths.cache, "packshot");
  if (!dir.exists) dir.create();
  const target = new File(dir, name);
  if (target.exists) target.delete();
  return File.downloadFileAsync(url, target);
}

export default function AssetViewer() {
  const { id, job } = useLocalSearchParams<{ id: string; job: string }>();
  const data = jobCache.get(job);
  const asset = data?.assets.find((a) => a.id === id);
  const [busy, setBusy] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  if (!asset || !data) {
    return <SafeAreaView style={[s.screen, { alignItems: "center", justifyContent: "center" }]}><Text style={s.body}>Image not found.</Text><Button title="Close" variant="ghost" onPress={() => router.back()} /></SafeAreaView>;
  }
  const reported = Array.isArray(asset.refund_requests) ? asset.refund_requests[0] : asset.refund_requests;
  const name = `${data.job.products.name.replace(/\W+/g, "-").toLowerCase()}-${asset.id.slice(0, 6)}.png`;
  const freeRemake = asset.remakes_used < 1 && Date.now() - new Date(asset.delivered_at).getTime() < 7 * 86_400_000;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try { await fn(); } catch (e) { Alert.alert("Couldn't do that", (e as Error).message); }
    setBusy(null);
  }

  const save = () => run("save", async () => {
    const perm = await requestPermissionsAsync(true);
    if (!perm.granted) throw new Error("Allow photo access in Settings to save images.");
    const file = await downloadToCache(asset.url!, name);
    await LibraryAsset.create(file.uri);
    setDone((d) => ({ ...d, save: true }));
  });

  const share = () => run("share", async () => {
    const file = await downloadToCache(asset.url!, name);
    await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: data.job.products.name });
  });

  const approve = () => run("approve", async () => {
    await api(`/api/assets/${asset.id}/approve`, { method: "POST", json: { approved: true } });
    asset.approval_status = "approved";
    setDone((d) => ({ ...d, approve: true }));
  });

  const remake = () => run("remake", async () => {
    const r = await api<{ jobId: string; free: boolean }>(`/api/assets/${asset.id}/remake`, { method: "POST", json: { idempotencyKey: newKey() } });
    router.back();
    router.push(`/job/${r.jobId}`);
  });

  const report = (reason: string) => run("report", async () => {
    const r = await api<{ status: string }>(`/api/assets/${asset.id}/report`, { method: "POST", json: { reason } });
    setReporting(false);
    Alert.alert(r.status === "auto_approved" ? "Credit returned" : "Report sent", r.status === "auto_approved" ? "Our checks confirmed the problem. Your credit is back." : "We'll review it within one working day.");
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.ink }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={28} color="#fff" /></Pressable>
        {data.references[0]?.url && (
          <Pressable onPressIn={() => setShowRef(true)} onPressOut={() => setShowRef(false)} style={{ borderWidth: 1, borderColor: "#ffffff55", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#fff", fontSize: 13 }}>Hold to see your photo</Text>
          </Pressable>
        )}
      </View>
      <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} centerContent>
        <Image source={{ uri: showRef ? data.references[0].url! : asset.url! }} style={{ width: "100%", aspectRatio: asset.width / asset.height }} contentFit="contain" />
      </ScrollView>
      <Text style={{ color: "#ffffff88", fontSize: 12, textAlign: "center", paddingHorizontal: 20, marginBottom: 8 }}>
        {asset.quality_status === "review" ? "Check the label closely before using this image. Pinch to zoom." : "Pinch to zoom and check the label before publishing."}
      </Text>
      {reporting ? (
        <View style={{ backgroundColor: C.paper, padding: 16, gap: 6, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
          <Text style={s.h2}>What changed?</Text>
          <Text style={s.small}>If your product changed, you get the credit back. For &quot;I don&apos;t like it&quot;, use a remake.</Text>
          {REASONS.map(([rid, label]) => <Pressable key={rid} onPress={() => report(rid)} style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line }}><Text style={{ fontSize: 15 }}>{label}</Text></Pressable>)}
          <Button title="Cancel" variant="ghost" onPress={() => setReporting(false)} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#ffffff22" }}>
          {[
            { k: "save", icon: done.save ? "checkmark" : "download-outline", label: done.save ? "Saved" : "Save", on: save },
            { k: "share", icon: "share-outline", label: "Share", on: share },
            { k: "approve", icon: asset.approval_status === "approved" ? "checkmark-circle" : "checkmark-circle-outline", label: asset.approval_status === "approved" ? "Approved" : "Approve", on: approve },
            { k: "remake", icon: "refresh", label: freeRemake ? "Free remake" : "Remake (1)", on: remake },
            ...(reported ? [] : [{ k: "report", icon: "flag-outline", label: "Report", on: async () => setReporting(true) }]),
          ].map((b) => (
            <Pressable key={b.k} onPress={b.on} disabled={!!busy} style={{ alignItems: "center", gap: 4, minWidth: 60 }}>
              {busy === b.k ? <ActivityIndicator color="#fff" /> : <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={24} color="#fff" />}
              <Text style={{ color: "#fff", fontSize: 11 }}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
