import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { Project, Stream } from "@zainlabs/content";
import { colors, statusColor } from "./theme";

/** Brand mark from the Canva template: eight-armed red asterisk built from rotated bars. */
export function Asterisk({ size = 22, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      {[0, 45, 90, 135].map((deg) => (
        <View
          key={deg}
          style={{
            position: "absolute",
            left: size * 0.45,
            top: 0,
            width: size * 0.1,
            height: size,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      ))}
    </View>
  );
}

export function StatusBadge({ status, solid }: { status: string; solid?: boolean }) {
  const c = statusColor(status);
  const fill = solid ?? status === "MVP";
  return (
    <View style={[s.badge, { borderColor: c, backgroundColor: fill ? c : "transparent" }]}>
      <Text style={[s.badgeText, { color: fill ? "#fff" : c }]}>{status}</Text>
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <View style={s.eyebrow}>
      <Asterisk size={11} />
      <Text style={s.eyebrowText}>{children.toUpperCase()}</Text>
    </View>
  );
}

const monogram = (title: string) =>
  title
    .split(/[\s/&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Square tile for the project grid on Home (the icon grid in the Canva app design). */
export function ProjectTile({ project, stream, style }: { project: Project; stream?: Stream; style?: ViewStyle }) {
  return (
    <Link href={`/project/${project.slug}`} asChild>
      <Pressable style={StyleSheet.flatten([s.tile, style])} accessibilityRole="link" accessibilityLabel={project.title}>
        <View style={s.tileIcon}>
          <Text style={s.tileMono}>{monogram(project.title)}</Text>
        </View>
        <Text style={s.tileTitle} numberOfLines={2}>{project.title}</Text>
        <Text style={s.tileMeta}>{stream?.code ?? ""} · {project.status}</Text>
      </Pressable>
    </Link>
  );
}

/** Row card for project lists. */
export function ProjectRow({ project, stream }: { project: Project; stream?: Stream }) {
  return (
    <Link href={`/project/${project.slug}`} asChild>
      <Pressable style={s.row} accessibilityRole="link">
        <View style={s.rowTop}>
          <Text style={s.rowMeta}>{stream ? `${stream.code} · ${stream.name}` : ""}</Text>
          <StatusBadge status={project.status} />
        </View>
        <Text style={s.rowTitle}>{project.title}</Text>
        <Text style={s.rowText}>{project.summary}</Text>
        <Text style={s.rowArrow}>→</Text>
      </Pressable>
    </Link>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      <Text style={[s.chipText, active && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  eyebrowText: { color: colors.accent, fontSize: 11, letterSpacing: 1.4, fontWeight: "600" },
  tile: { backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line, gap: 6 },
  tileIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  tileMono: { color: colors.paper, fontWeight: "700", letterSpacing: 0.5 },
  tileTitle: { fontSize: 13, fontWeight: "600", color: colors.ink, minHeight: 34 },
  tileMeta: { fontSize: 10, color: colors.muted },
  row: { backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.line, gap: 8 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowMeta: { fontSize: 11, color: colors.muted, letterSpacing: 0.3 },
  rowTitle: { fontSize: 20, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
  rowText: { fontSize: 14, color: "#5d5c58", lineHeight: 20 },
  rowArrow: { color: colors.accent, fontSize: 18 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "500" },
});
