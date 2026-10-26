import { Platform, StyleSheet } from "react-native";

export const C = {
  paper: "#F4F1EA",
  paper2: "#EBE6DB",
  card: "#FBFAF6",
  ink: "#141310",
  ink2: "#3B3934",
  mute: "#77736A",
  line: "#D9D3C5",
  accent: "#E2531B",
  good: "#2F6B45",
  warn: "#A86A00",
  bad: "#B42318",
};

export const F = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  pad: { paddingHorizontal: 20 },
  display: { fontFamily: F.display, fontSize: 36, color: C.ink, letterSpacing: -0.5, lineHeight: 38 },
  h2: { fontFamily: F.display, fontSize: 26, color: C.ink },
  eyebrow: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: C.mute },
  body: { fontSize: 15, color: C.ink2, lineHeight: 21 },
  small: { fontSize: 13, color: C.mute },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", paddingHorizontal: 14, fontSize: 16, color: C.ink },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
});
