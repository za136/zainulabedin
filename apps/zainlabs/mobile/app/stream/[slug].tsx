import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { StreamSlug } from "@zainlabs/content";
import { useContent } from "@/content";
import { Eyebrow, ProjectRow } from "@/components";
import { colors } from "@/theme";

export default function StreamScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { stream, projectsIn } = useContent();
  const s = stream(slug);
  if (!s) return <Text style={{ padding: 20 }}>Stream not found.</Text>;
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Stack.Screen options={{ title: s.name }} />
      <View style={st.head}>
        <Eyebrow>{`${s.code} · ${s.tagline}`}</Eyebrow>
        <Text style={st.h1}>{s.name}</Text>
        <Text style={st.lead}>{s.description}</Text>
        {s.capabilities.map((c) => (
          <Text key={c} style={st.cap}><Text style={{ color: colors.accent }}>— </Text>{c}</Text>
        ))}
      </View>
      {projectsIn(s.slug as StreamSlug).map((p) => (
        <ProjectRow key={p.slug} project={p} stream={s} />
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 20, gap: 12, paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center" },
  head: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, gap: 10, marginBottom: 6 },
  h1: { fontSize: 34, color: colors.paper, fontWeight: "400", letterSpacing: -0.6 },
  lead: { color: "#c9c6bf", fontSize: 15, lineHeight: 22 },
  cap: { color: colors.paper, fontSize: 14 },
});
