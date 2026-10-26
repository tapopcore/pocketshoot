import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { api, newKey, uploadImages, ApiError } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useSession } from "@/lib/session";
import { Button, Chip, Notice } from "@/components/ui";
import { C, F, s } from "@/lib/theme";

export default function Look() {
  const { draft, set, reset } = useDraft();
  const { me, refresh } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newKey());
  const hi = me?.user?.locale === "hi";
  const cat = me?.catalog.categories.find((c) => c.id === draft.category);
  const styles = [...(me?.catalog.styles ?? [])].sort((a, b) => {
    const r = cat?.recommendedPresets ?? [];
    return (r.indexOf(a.id) === -1 ? 99 : r.indexOf(a.id)) - (r.indexOf(b.id) === -1 ? 99 : r.indexOf(b.id));
  });
  const balance = me?.wallet.available ?? 0;
  const max = me?.policy.maxImagesPerJob ?? 8;
  const short = draft.count > balance;

  async function start() {
    setError(null);
    try {
      let productId = draft.productId;
      if (!productId) {
        setBusy("Uploading photos");
        const keys = await uploadImages(draft.photos);
        setBusy("Checking photos");
        const views = ["front", "angle", "back"];
        const r = await api<{ productId: string }>("/api/products", { method: "POST", json: { name: draft.productName.trim(), category: draft.category, locks: draft.locks, uploads: keys.map((k, i) => ({ key: k, viewType: views[i] ?? "angle" })) } });
        productId = r.productId;
        set({ productId });
      }
      setBusy("Starting");
      const j = await api<{ jobId: string }>("/api/jobs", { method: "POST", json: { productId, mode: draft.mode, style: draft.style, output: draft.output, count: draft.count, customBrief: draft.customBrief || null, idempotencyKey: key.current } });
      refresh();
      reset();
      router.dismissAll();
      router.push(`/job/${j.jobId}`);
    } catch (e) {
      setBusy(null);
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 140 }}>
        <View style={{ gap: 8 }}>
          <Text style={s.eyebrow}>Mode</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["preserve", "creative"] as const).map((m) => {
              const on = draft.mode === m;
              const off = m === "creative" && !me?.features.creativeMode;
              return (
                <Pressable key={m} disabled={off} onPress={() => set({ mode: m })} style={[s.card, { flex: 1, padding: 14, opacity: off ? 0.4 : 1 }, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
                  <Text style={{ fontWeight: "600", color: on ? "#fff" : C.ink }}>{m === "preserve" ? (hi ? "प्रोडक्ट बिल्कुल वैसा" : "Keep product exact") : (hi ? "क्रिएटिव" : "Creative")}</Text>
                  <Text style={{ fontSize: 12, marginTop: 4, color: on ? "#ffffffaa" : C.mute }}>{m === "preserve" ? "Label and logo kept from your photo" : "New angles; labels may change"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={s.eyebrow}>Style</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {styles.map((st, i) => {
              const on = draft.style === st.id;
              return (
                <Pressable key={st.id} onPress={() => set({ style: st.id })} style={{ width: "31%", borderRadius: 12, overflow: "hidden", borderWidth: on ? 2 : 1, borderColor: on ? C.ink : C.line }}>
                  <LinearGradient colors={st.swatch} style={{ height: 64, justifyContent: "flex-end", alignItems: "center" }}>
                    <Text style={{ position: "absolute", top: 4, left: 6, fontFamily: F.mono, fontSize: 9, color: st.id === "luxury_dark" ? "#fff8" : C.mute }}>{String(i + 1).padStart(2, "0")}</Text>
                    <View style={{ width: 14, height: 26, borderRadius: 3, backgroundColor: "#2f5a41", marginBottom: 8 }} />
                  </LinearGradient>
                  <Text numberOfLines={1} style={{ padding: 6, fontSize: 12, backgroundColor: C.card, color: C.ink }}>{hi ? st.nameHi : st.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {draft.style === "custom" && (
            <TextInput multiline style={[s.input, { height: 90, paddingTop: 12 }]} placeholder="Describe the scene, e.g. on a wooden café table with morning light" placeholderTextColor={C.mute} value={draft.customBrief} onChangeText={(t) => set({ customBrief: t })} maxLength={500} />
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={s.eyebrow}>Size</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(me?.catalog.outputs ?? []).map((o) => <Chip key={o.id} label={`${o.name} ${o.ratio}`} on={draft.output === o.id} onPress={() => set({ output: o.id })} />)}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={s.eyebrow}>Images</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <Pressable key={n} onPress={() => set({ count: n })} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: draft.count === n ? C.accent : C.line, backgroundColor: draft.count === n ? C.accent : C.card }}>
                <Text style={{ color: draft.count === n ? "#fff" : C.ink, fontFamily: F.mono }}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {short && <Notice tone="bad">You need {draft.count - balance} more credits. Buy a pack in the Credits tab or choose fewer images.</Notice>}
        {draft.mode === "creative" && <Notice tone="warn">Creative mode can change small text on the product. Check every image closely.</Notice>}
        {error && <Notice tone="bad">{error}</Notice>}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 34, backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line, gap: 6 }}>
        <Text style={[s.small, { textAlign: "center" }]}>{draft.count} credits · you have {balance}. Failed images cost nothing.</Text>
        <Button title={busy ? `${busy}…` : `Create ${draft.count} image${draft.count > 1 ? "s" : ""}`} variant="accent" onPress={start} loading={!!busy} disabled={short || (draft.style === "custom" && draft.customBrief.trim().length < 6)} />
      </View>
    </View>
  );
}
