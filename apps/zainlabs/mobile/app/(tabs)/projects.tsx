import { useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StreamSlug } from "@zainlabs/content";
import { useContent } from "@/content";
import { Chip, Eyebrow, ProjectRow } from "@/components";
import { colors } from "@/theme";

export default function Projects() {
  const { projects, streams, stream } = useContent();
  const [filter, setFilter] = useState<StreamSlug | null>(null);
  const list = filter ? projects.filter((p) => p.stream === filter) : projects;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <FlatList
        data={list}
        keyExtractor={(p) => p.slug}
        contentContainerStyle={st.page}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Eyebrow>Portfolio</Eyebrow>
            <Text style={st.h1}>Projects</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label={`All (${projects.length})`} active={!filter} onPress={() => setFilter(null)} />
              {streams.map((s) => (
                <Chip key={s.slug} label={s.name} active={filter === s.slug} onPress={() => setFilter(s.slug)} />
              ))}
            </ScrollView>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <ProjectRow project={item} stream={stream(item.stream)} />}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { padding: 20, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" },
  h1: { fontSize: 34, fontWeight: "400", color: colors.ink, letterSpacing: -0.6, marginBottom: 4 },
});
