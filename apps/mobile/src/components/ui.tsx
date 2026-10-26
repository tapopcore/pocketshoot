import { ActivityIndicator, Pressable, Text, View, type PressableProps, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { C, s } from "@/lib/theme";

export function Button({ title, onPress, variant = "primary", disabled, loading, style }: {
  title: string; onPress?: PressableProps["onPress"]; variant?: "primary" | "accent" | "ghost" | "outline"; disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const bg = variant === "primary" ? C.ink : variant === "accent" ? C.accent : "transparent";
  const fg = variant === "primary" || variant === "accent" ? "#fff" : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(e); }}
      style={({ pressed }) => [{
        height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, backgroundColor: bg,
        borderWidth: variant === "outline" ? 1 : 0, borderColor: C.ink, opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 16, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected: on }} style={[s.chip, on && s.chipOn]}>
      <Text style={{ color: on ? "#fff" : C.ink, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "bad" | "good" }) {
  const colors = { neutral: [C.paper2, C.ink2], warn: ["#F7EBD3", "#5C3B00"], bad: ["#F6DEDA", C.bad], good: ["#DDEBE1", C.good] }[tone];
  return <View style={{ backgroundColor: colors[0], borderRadius: 12, padding: 12 }}><Text style={{ color: colors[1], fontSize: 14, lineHeight: 20 }}>{children}</Text></View>;
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={[s.card, { flex: 1, padding: 14 }]}>
      <Text style={s.eyebrow}>{label}</Text>
      <Text style={[s.display, { fontSize: 34, marginTop: 6 }]}>{value}</Text>
    </View>
  );
}
