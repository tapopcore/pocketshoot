import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDraft } from "@/lib/draft";
import { prepareForUpload } from "@/lib/photos";
import { Button } from "@/components/ui";
import { C, s } from "@/lib/theme";

const HINTS = ["Front of the product", "Now an angle (optional)", "Back (optional)"];

/** Camera with a framing guide. Up to 3 photos, from the camera or the gallery. */
export default function Capture() {
  const [perm, request] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const { draft, set } = useDraft();
  const [shots, setShots] = useState<string[]>(draft.photos.filter((p) => p.startsWith("file:")));
  const [busy, setBusy] = useState(false);

  async function snap() {
    if (!cam.current || shots.length >= 3) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const p = await cam.current.takePictureAsync({ quality: 0.92 });
      if (p) setShots([...shots, await prepareForUpload(p.uri, p.width, p.height)]);
    } finally { setBusy(false); }
  }

  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 3 - shots.length, quality: 1 });
    if (r.canceled) return;
    setBusy(true);
    const ready = await Promise.all(r.assets.map((a) => prepareForUpload(a.uri, a.width, a.height)));
    setShots([...shots, ...ready].slice(0, 3));
    setBusy(false);
  }

  function next() {
    set({ photos: shots, productId: null });
    router.push("/shoot/details");
  }

  if (!perm) return <View style={[s.screen, { backgroundColor: "#000" }]} />;
  if (!perm.granted) {
    return (
      <SafeAreaView style={[s.screen, { padding: 24, justifyContent: "center", gap: 16 }]}>
        <Text style={s.display}>Camera access</Text>
        <Text style={s.body}>We use the camera only to photograph your products. You can also pick photos from your gallery instead.</Text>
        <Button title="Allow camera" onPress={request} />
        <Button title="Choose from gallery" variant="outline" onPress={pick} />
        {shots.length > 0 && <Button title={`Continue with ${shots.length} photo${shots.length > 1 ? "s" : ""}`} variant="accent" onPress={next} />}
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={cam} style={{ flex: 1 }} facing="back" />
      {/* Framing guide */}
      <View pointerEvents="none" style={{ position: "absolute", top: "18%", bottom: "26%", left: "14%", right: "14%" }}>
        {[{ top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }, { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }, { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }, { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }].map((st, i) => (
          <View key={i} style={[{ position: "absolute", width: 34, height: 34, borderColor: "#fff" }, st]} />
        ))}
      </View>
      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }} edges={["top"]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="close" size={28} color="#fff" /></Pressable>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{HINTS[Math.min(shots.length, 2)]}</Text>
          <View style={{ width: 28 }} />
        </View>
        <Text style={{ color: "#ffffffcc", textAlign: "center", fontSize: 13, paddingHorizontal: 30 }}>Plain surface, soft daylight, no flash. Fill the frame so the label is sharp.</Text>
      </SafeAreaView>
      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#000000aa", paddingTop: 12 }}>
        <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingHorizontal: 16, minHeight: 56 }}>
          {shots.map((u, i) => (
            <Pressable key={u} onPress={() => setShots(shots.filter((_, j) => j !== i))}>
              <Image source={{ uri: u }} style={{ width: 52, height: 52, borderRadius: 8 }} />
              <View style={{ position: "absolute", top: -4, right: -4, backgroundColor: C.ink, borderRadius: 10 }}><Ionicons name="close-circle" size={18} color="#fff" /></View>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 14 }}>
          <Pressable onPress={pick} hitSlop={12} accessibilityLabel="Choose from gallery"><Ionicons name="images-outline" size={28} color="#fff" /></Pressable>
          <Pressable onPress={snap} disabled={busy || shots.length >= 3} accessibilityLabel="Take photo"
            style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center", opacity: shots.length >= 3 ? 0.4 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.accent }} />}
          </Pressable>
          <Pressable onPress={next} disabled={shots.length === 0} hitSlop={12} style={{ opacity: shots.length ? 1 : 0.3 }} accessibilityLabel="Next">
            <Ionicons name="arrow-forward-circle" size={40} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
