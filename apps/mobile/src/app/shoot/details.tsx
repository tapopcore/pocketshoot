import { useEffect } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useDraft } from "@/lib/draft";
import { useSession } from "@/lib/session";
import { Button, Chip, Notice } from "@/components/ui";
import { C, s } from "@/lib/theme";

const LOCK_LABELS: Record<string, string> = {
  label_text: "Label text", logo: "Logo", colour: "Colour", shape: "Shape", cap_closure: "Cap / lid", material: "Material", item_count: "Number of items",
};

export default function Details() {
  const { draft, set } = useDraft();
  const { me } = useSession();
  const hi = me?.user?.locale === "hi";
  const cats = me?.catalog.categories ?? [];
  const cat = cats.find((c) => c.id === draft.category);

  useEffect(() => {
    if (cat && draft.locks.length === 0) set({ locks: cat.defaultLocks, style: cat.recommendedPresets[0] });
  }, [cat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", gap: 8 }}>
        {draft.photos.map((p) => <Image key={p} source={{ uri: p }} style={{ width: 70, height: 88, borderRadius: 8 }} />)}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.eyebrow}>Product name</Text>
        <TextInput style={s.input} value={draft.productName} onChangeText={(t) => set({ productName: t })} placeholder="Vitamin C serum 30ml" placeholderTextColor={C.mute} maxLength={120} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.eyebrow}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {cats.map((c) => <Chip key={c.id} label={hi ? c.labelHi : c.label} on={c.id === draft.category} onPress={() => set({ category: c.id, locks: c.defaultLocks, style: c.recommendedPresets[0] })} />)}
        </View>
        {cat?.caution && <Notice tone={cat.difficulty === "harder" ? "warn" : "neutral"}>{cat.caution}</Notice>}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.eyebrow}>Must not change</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(LOCK_LABELS).map(([id, label]) => {
            const on = draft.locks.includes(id);
            return <Chip key={id} label={(on ? "✓ " : "") + label} on={on} onPress={() => set({ locks: on ? draft.locks.filter((l) => l !== id) : [...draft.locks, id] })} />;
          })}
        </View>
      </View>
      <Button title="Continue" onPress={() => router.push("/shoot/look")} disabled={!draft.productName.trim()} />
    </ScrollView>
  );
}
