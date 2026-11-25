import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useContent } from "@/content";
import { Eyebrow, StatusBadge } from "@/components";
import { colors } from "@/theme";

export default function ProjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { project, stream } = useContent();
  const p = project(slug);
  if (!p) return <Text style={{ padding: 20 }}>Project not found.</Text>;
  const s = stream(p.stream);
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Stack.Screen options={{ title: p.title }} />
      <View style={st.head}>
        <Eyebrow onDark>{`${s?.code ?? ""} · ${s?.name ?? ""}${p.code ? ` · ${p.code}` : ""}`}</Eyebrow>
        <Text style={st.h1}>{p.title}</Text>
        <Text style={st.lead}>{p.summary}</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <StatusBadge status={p.status} solid />
          <Text style={{ color: colors.muted }}>{p.year}</Text>
        </View>
      </View>
      {p.description.map((d) => (
        <Text key={d} style={st.body}>{d}</Text>
      ))}
      <Text style={st.label}>HIGHLIGHTS</Text>
      {p.highlights.map((h) => (
        <Text key={h} style={st.body}><Text style={{ color: colors.accent }}>— </Text>{h}</Text>
      ))}
      <Text style={st.label}>STACK</Text>
      <View style={st.tags}>
        {p.stack.map((t) => (
          <Text key={t} style={st.tag}>{t}</Text>
        ))}
      </View>
      {p.links.map((l) => (
        <Pressable key={l.url} style={st.btnDark} onPress={() => Linking.openURL(l.url)} accessibilityRole="link">
          <Text style={st.btnText}>{l.label} ↗</Text>
        </Pressable>
      ))}
      <Link href="/contact" asChild>
        <Pressable style={st.btn} accessibilityRole="link">
          <Text style={st.btnText}>Ask about this project →</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 20, gap: 12, paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center" },
  head: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, gap: 10, marginBottom: 8 },
  h1: { fontSize: 32, color: colors.paper, fontWeight: "400", letterSpacing: -0.6 },
  lead: { color: "#c9c6bf", fontSize: 16, lineHeight: 23 },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  label: { fontSize: 11, color: colors.muted, letterSpacing: 1.2, marginTop: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, overflow: "hidden" },
  btn: { backgroundColor: colors.accent, borderRadius: 999, padding: 15, alignItems: "center", marginTop: 8 },
  btnDark: { backgroundColor: colors.ink, borderRadius: 999, padding: 15, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
});
