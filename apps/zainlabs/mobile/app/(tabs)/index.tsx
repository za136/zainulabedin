import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useContent } from "@/content";
import { Chip, Eyebrow, ProjectTile } from "@/components";
import { colors } from "@/theme";

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
};

export default function Home() {
  const { projects, streams, stream, syncing, refresh, source } = useContent();
  const { width } = useWindowDimensions();
  const featured = projects.find((p) => p.featured) ?? projects[0];
  const rest = projects.filter((p) => p.slug !== featured?.slug);
  const tileW = (Math.min(width, 520) - 40 - 20) / 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top"]}>
      <ScrollView contentContainerStyle={st.page} refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}>
        <View style={st.header}>
          <Text style={st.brand} accessibilityRole="header">ZAIN LABS</Text>
          <Text style={st.greeting}>{greeting()}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
          {streams.map((s) => (
            <Chip key={s.slug} label={s.name} onPress={() => router.push(`/stream/${s.slug}`)} />
          ))}
        </ScrollView>

        {featured && (
          <Link href={`/project/${featured.slug}`} asChild>
            <Pressable style={st.featured} accessibilityRole="link" accessibilityLabel={`Featured: ${featured.title}`}>
              <Image source={require("../../assets/brand/hero-3d.jpg")} style={st.featuredImg} contentFit="cover" />
              <View style={st.featuredBadge}><Text style={st.featuredBadgeText}>{featured.status === "MVP" ? "MVP" : "NEW"}</Text></View>
              <View style={st.featuredCard}>
                <Text style={st.featuredKicker}>{stream(featured.stream)?.code} · FEATURED</Text>
                <Text style={st.featuredTitle}>{featured.title}</Text>
                <Text style={st.featuredText} numberOfLines={3}>{featured.summary}</Text>
              </View>
            </Pressable>
          </Link>
        )}

        <View style={st.sectionHead}>
          <Eyebrow>All projects</Eyebrow>
          <Text style={st.sync}>{syncing ? "Syncing…" : source === "live" ? "Up to date" : "Offline copy"}</Text>
        </View>
        <View style={st.grid}>
          {rest.map((p) => (
            <ProjectTile key={p.slug} project={p} stream={stream(p.stream)} style={{ width: tileW }} />
          ))}
        </View>

        <View style={st.statsRow}>
          {[
            [String(streams.length), "Streams"],
            [String(projects.length), "Projects"],
            ["DACH", "Focus"],
          ].map(([n, l]) => (
            <View key={l} style={st.stat}>
              <View style={st.dot}><Text style={[st.dotText, n.length > 3 && { fontSize: 13, letterSpacing: 0.5 }]} numberOfLines={1}>{n}</Text></View>
              <Text style={st.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40, gap: 18, maxWidth: 560, width: "100%", alignSelf: "center" },
  header: { alignItems: "center", paddingTop: 18, paddingBottom: 4 },
  brand: { fontSize: 38, fontWeight: "300", letterSpacing: 2, color: colors.ink },
  greeting: { fontSize: 15, color: colors.muted, marginTop: 2 },
  chips: { gap: 8, paddingVertical: 2 },
  featured: { borderRadius: 26, backgroundColor: colors.ink, padding: 10, overflow: "hidden" },
  featuredImg: { height: 150, borderRadius: 18, backgroundColor: colors.paper2 },
  featuredBadge: { position: "absolute", top: 22, right: 22, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  featuredBadgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  featuredCard: { backgroundColor: colors.paper, borderRadius: 18, padding: 18, marginTop: 10, gap: 6 },
  featuredKicker: { fontSize: 11, color: colors.accent, letterSpacing: 1.2, fontWeight: "600" },
  featuredTitle: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.5 },
  featuredText: { fontSize: 15, color: "#4a4945", lineHeight: 21 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  sync: { fontSize: 11, color: colors.muted, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.ink, borderRadius: 22, padding: 18, marginTop: 8 },
  stat: { alignItems: "center", gap: 8, flex: 1 },
  dot: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  dotText: { color: "#fff", fontSize: 20, fontWeight: "600" },
  statLabel: { color: colors.paper, fontSize: 12 },
});
