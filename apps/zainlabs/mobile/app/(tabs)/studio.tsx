import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useContent } from "@/content";
import { Eyebrow, ProjectRow } from "@/components";
import { colors } from "@/theme";

export default function Studio() {
  const { stream, projectsIn } = useContent();
  const studio = stream("studio");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }} edges={["top"]}>
      <ScrollView contentContainerStyle={st.page}>
        <Eyebrow onDark>{`${studio?.code ?? "F4"} · Studio`}</Eyebrow>
        <Text style={st.h1}>Film, music & channel content.</Text>
        <Text style={st.lead}>{studio?.description}</Text>
        <View style={{ gap: 12, marginTop: 8 }}>
          {projectsIn("studio").map((p) => (
            <ProjectRow key={p.slug} project={p} stream={studio} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { padding: 20, gap: 12, maxWidth: 640, width: "100%", alignSelf: "center" },
  h1: { fontSize: 32, fontWeight: "400", color: colors.paper, letterSpacing: -0.6, lineHeight: 36 },
  lead: { color: "#b3b0a9", fontSize: 15, lineHeight: 22 },
});
