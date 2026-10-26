import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { config } from "@/lib/config";
import { Button, Notice } from "@/components/ui";
import { C, s } from "@/lib/theme";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, data: { source: "mobile" } } });
    setBusy(false);
    if (error) setError(error.message.includes("rate") ? "Too many tries. Wait a minute." : error.message);
    else setStage("code");
  }

  async function verify() {
    setBusy(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("That code didn't work. Check the latest email.");
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "space-between", padding: 24 }}>
        <View style={{ marginTop: 40 }}>
          <Text style={s.eyebrow}>PocketShoot</Text>
          <Text style={[s.display, { fontSize: 46, lineHeight: 48, marginTop: 14 }]}>Your phone photo in.{"\n"}<Text style={{ color: C.accent, fontStyle: "italic" }}>Studio shot</Text> out.</Text>
          <Text style={[s.body, { marginTop: 16 }]}>Sign in with your email. New here? You get 2 free images.</Text>
        </View>
        <View style={{ gap: 12 }}>
          {stage === "email" ? (
            <>
              <TextInput style={s.input} placeholder="you@yourbrand.com" placeholderTextColor={C.mute} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
              <Button title="Email me a code" onPress={send} loading={busy} disabled={!email.includes("@")} />
            </>
          ) : (
            <>
              <Text style={s.body}>Enter the 6-digit code we sent to <Text style={{ fontWeight: "600" }}>{email}</Text>.</Text>
              <TextInput style={[s.input, { textAlign: "center", letterSpacing: 8, fontSize: 22 }]} keyboardType="number-pad" autoComplete="one-time-code" maxLength={8} value={code} onChangeText={setCode} />
              <Button title="Sign in" onPress={verify} loading={busy} disabled={code.length < 6} />
              <Pressable onPress={() => setStage("email")}><Text style={[s.small, { textAlign: "center" }]}>Use a different email</Text></Pressable>
            </>
          )}
          {error && <Notice tone="bad">{error}</Notice>}
          <Text style={[s.small, { textAlign: "center", marginTop: 8 }]}>
            By continuing you agree to the <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${config.apiUrl}/legal/terms`)}>Terms</Text> and <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${config.apiUrl}/legal/privacy`)}>Privacy Policy</Text>.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
