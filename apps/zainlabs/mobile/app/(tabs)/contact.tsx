import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StreamSlug } from "@zainlabs/content";
import { sendContact, useContent } from "@/content";
import { Chip, Eyebrow } from "@/components";
import { colors } from "@/theme";

export default function Contact() {
  const { streams, site } = useContent();
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [stream, setStream] = useState<StreamSlug>("software");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "ok">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError("");
    setState("sending");
    const r = await sendContact({ ...form, stream, consent });
    if (r.ok) setState("ok");
    else {
      setState("idle");
      setError(r.error ?? "Something went wrong.");
    }
  }

  if (state === "ok")
    return (
      <SafeAreaView style={[st.safe, { justifyContent: "center", padding: 24 }]}>
        <Eyebrow>Sent</Eyebrow>
        <Text style={st.h1}>Thank you.</Text>
        <Text style={st.lead}>We have your message and will reply within two working days.</Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
          <Eyebrow>Contact</Eyebrow>
          <Text style={st.h1}>Start a project.</Text>
          <Text style={st.lead}>Tell us what you want to build for the DACH market. Or write to {site.email}.</Text>
          <TextInput style={st.input} placeholder="Name" value={form.name} onChangeText={set("name")} autoComplete="name" />
          <TextInput style={st.input} placeholder="Email" value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <TextInput style={st.input} placeholder="Company (optional)" value={form.company} onChangeText={set("company")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {streams.map((s) => (
              <Chip key={s.slug} label={s.name} active={stream === s.slug} onPress={() => setStream(s.slug)} />
            ))}
          </ScrollView>
          <TextInput style={[st.input, { height: 130, textAlignVertical: "top" }]} placeholder="Your message" value={form.message} onChangeText={set("message")} multiline />
          <View style={st.consent}>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.accent }} accessibilityLabel="Consent to store my details" />
            <Text style={st.consentText}>I agree that ZAIN LABS stores my details to answer this request (see privacy notice on the website).</Text>
          </View>
          {!!error && <Text style={st.error}>{error}</Text>}
          <Pressable style={[st.btn, state === "sending" && { opacity: 0.6 }]} onPress={submit} disabled={state === "sending"} accessibilityRole="button">
            <Text style={st.btnText}>{state === "sending" ? "Sending…" : "Send message →"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  page: { padding: 20, gap: 12, maxWidth: 640, width: "100%", alignSelf: "center" },
  h1: { fontSize: 34, fontWeight: "400", color: colors.ink, letterSpacing: -0.6 },
  lead: { color: colors.muted, fontSize: 15, lineHeight: 21, marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, fontSize: 16 },
  consent: { flexDirection: "row", gap: 12, alignItems: "center" },
  consentText: { flex: 1, color: colors.muted, fontSize: 13 },
  error: { color: colors.accent, backgroundColor: "#f8e1df", padding: 12, borderRadius: 10 },
  btn: { backgroundColor: colors.accent, borderRadius: 999, padding: 16, alignItems: "center", marginTop: 6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
